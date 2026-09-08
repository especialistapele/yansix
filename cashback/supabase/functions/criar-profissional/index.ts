import { withSupabase } from 'npm:@supabase/server@^1'

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method === 'OPTIONS') return new Response('ok')
      if (req.method !== 'POST') return Response.json({ error: 'Método não permitido.' }, { status: 405 })

      // Não confiamos apenas em ctx.userClaims (decodificação local do JWT): em projetos com
      // chaves de assinatura assimétricas, essa decodificação pode falhar mesmo com um token
      // válido. auth.getUser() valida o token contra o servidor de Auth via rede, o que é
      // confiável independente do formato/algoritmo de assinatura da chave do projeto.
      let uid = ctx.userClaims?.sub
      if (!uid) {
        const { data: userData, error: userErr } = await ctx.supabase.auth.getUser()
        if (userErr || !userData?.user) return Response.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 })
        uid = userData.user.id
      }

      const { data: p, error: pe } = await ctx.supabaseAdmin
        .from('perfis').select('id,role,estabelecimento_id').eq('id', uid).maybeSingle()
      if (pe) return Response.json({ error: `Perfil: ${pe.message}` }, { status: 500 })
      if (!p || !['admin_master', 'admin_estabelecimento'].includes(p.role)) {
        return Response.json({ error: 'Apenas administradores podem cadastrar profissionais.' }, { status: 403 })
      }

      const b = await req.json()
      const email = String(b?.email ?? '').trim().toLowerCase()
      const senha = String(b?.senha ?? '')
      const nome = String(b?.nome_profissional ?? '').trim()
      const eid = p.role === 'admin_estabelecimento' ? p.estabelecimento_id : String(b?.estabelecimento_id ?? '').trim()

      if (!email || !senha || !nome || !eid) return Response.json({ error: 'Informe nome, e-mail, senha e estabelecimento.' }, { status: 400 })
      if (senha.length < 6) return Response.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })

      const { data: e, error: ee } = await ctx.supabaseAdmin
        .from('estabelecimentos').select('id,status,max_profissionais,quota_dados_bytes').eq('id', eid).maybeSingle()
      if (ee) return Response.json({ error: `Estabelecimento: ${ee.message}` }, { status: 500 })
      if (!e) return Response.json({ error: 'Estabelecimento não encontrado.' }, { status: 404 })
      if (e.status === 'inativo') return Response.json({ error: 'O estabelecimento está inativo.' }, { status: 400 })

      const { data: lim, error: le } = await ctx.supabaseAdmin.rpc('verificar_limite_cadastro', { p_estabelecimento_id: eid, p_tipo: 'profissional' })
      if (le) return Response.json({ error: `Limites: ${le.message}` }, { status: 500 })
      if (!lim?.ok) return Response.json({ error: lim?.mensagem || 'Limite da unidade atingido.', codigo: lim?.codigo, consumo: lim?.consumo }, { status: 409 })

      const { data: nu, error: ue } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password: senha, email_confirm: true,
        user_metadata: { nome, tipo: 'profissional' }
      })
      if (ue || !nu.user) {
        const msg = ue?.message || 'não foi possível criar o profissional.'
        const duplicate = /already|exist|registered|duplicate|cadastrad/i.test(msg)
        return Response.json({ error: duplicate ? 'Este e-mail já está cadastrado no Supabase Auth. Use outro e-mail.' : `Auth: ${msg}` }, { status: 400 })
      }

      const { error: pe2 } = await ctx.supabaseAdmin.from('perfis').insert({
        id: nu.user.id, role: 'profissional', estabelecimento_id: eid, nome, email
      })
      if (pe2) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(nu.user.id)
        return Response.json({ error: `Perfil: ${pe2.message}` }, { status: 500 })
      }

      const { error: ae } = await ctx.supabaseAdmin.from('auditoria_admin').insert({
        estabelecimento_id: eid, ator_id: uid, evento: 'criação', entidade: 'profissionais', entidade_id: nu.user.id,
        detalhes: { profissional_id: nu.user.id, nome, email }
      })
      if (ae) console.error('Auditoria profissional:', ae.message)

      return Response.json({ ok: true, estabelecimento_id: eid, user_id: nu.user.id })
    } catch (err) {
      console.error('criar-profissional:', err)
      return Response.json({ error: `Falha inesperada: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
  })
}
