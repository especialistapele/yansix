import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method === 'OPTIONS') return new Response('ok')
      if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 })

      let uid = ctx.userClaims?.sub
      if (!uid) {
        const { data: userData, error: userErr } = await ctx.supabase.auth.getUser()
        if (userErr || !userData?.user) return Response.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 })
        uid = userData.user.id
      }

      const { data: quem, error: qe } = await ctx.supabaseAdmin
        .from('perfis').select('id,role,estabelecimento_id').eq('id', uid).maybeSingle()
      if (qe) return Response.json({ error: `Perfil: ${qe.message}` }, { status: 500 })
      if (!quem || !['admin_master', 'admin_estabelecimento'].includes(quem.role)) {
        return Response.json({ error: 'Apenas administradores podem editar profissionais.' }, { status: 403 })
      }

      const b = await req.json()
      const profissionalId = String(b?.profissional_id ?? '').trim()
      const nome = b?.nome !== undefined ? String(b.nome).trim() : undefined
      const email = b?.email !== undefined ? String(b.email).trim().toLowerCase() : undefined
      const senha = b?.senha !== undefined ? String(b.senha) : undefined
      if (!profissionalId) return Response.json({ error: 'Informe o profissional.' }, { status: 400 })
      if (senha && senha.length < 6) return Response.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })

      const { data: alvo, error: ae } = await ctx.supabaseAdmin
        .from('perfis').select('id,role,estabelecimento_id').eq('id', profissionalId).maybeSingle()
      if (ae) return Response.json({ error: `Profissional: ${ae.message}` }, { status: 500 })
      if (!alvo || alvo.role !== 'profissional') return Response.json({ error: 'Profissional não encontrado.' }, { status: 404 })
      if (quem.role === 'admin_estabelecimento' && alvo.estabelecimento_id !== quem.estabelecimento_id) {
        return Response.json({ error: 'Este profissional não pertence à sua unidade.' }, { status: 403 })
      }

      // Atualiza e-mail/senha no Supabase Auth quando informados.
      if (email || senha) {
        const authUpdate = {}
        if (email) authUpdate.email = email
        if (senha) authUpdate.password = senha
        const { error: ue } = await ctx.supabaseAdmin.auth.admin.updateUserById(profissionalId, authUpdate)
        if (ue) {
          const msg = ue.message || 'não foi possível atualizar o login.'
          const duplicate = /already|exist|registered|duplicate|cadastrad/i.test(msg)
          return Response.json({ error: duplicate ? 'Este e-mail já está em uso por outra conta.' : `Auth: ${msg}` }, { status: 400 })
        }
      }

      // Atualiza dados de cadastro (nome/e-mail) na tabela de perfis.
      const perfilUpdate = {}
      if (nome !== undefined && nome !== '') perfilUpdate.nome = nome
      if (email) perfilUpdate.email = email
      if (Object.keys(perfilUpdate).length) {
        const { error: pe } = await ctx.supabaseAdmin.from('perfis').update(perfilUpdate).eq('id', profissionalId)
        if (pe) return Response.json({ error: `Perfil: ${pe.message}` }, { status: 500 })
      }

      const { error: aue } = await ctx.supabaseAdmin.from('auditoria_admin').insert({
        estabelecimento_id: alvo.estabelecimento_id, ator_id: uid, evento: 'atualização', entidade: 'profissionais', entidade_id: profissionalId,
        detalhes: { profissional_id: profissionalId, campos: Object.keys({ ...(nome !== undefined ? { nome: true } : {}), ...(email ? { email: true } : {}), ...(senha ? { senha: true } : {}) }) }
      })
      if (aue) console.error('Auditoria edição profissional:', aue.message)

      return Response.json({ ok: true })
    } catch (err) {
      console.error('editar-profissional:', err)
      return Response.json({ error: `Falha inesperada: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
  })
}
