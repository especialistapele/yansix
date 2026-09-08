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
        return Response.json({ error: 'Apenas administradores podem excluir profissionais.' }, { status: 403 })
      }

      const b = await req.json()
      const profissionalId = String(b?.profissional_id ?? '').trim()
      if (!profissionalId) return Response.json({ error: 'Informe o profissional.' }, { status: 400 })
      if (profissionalId === uid) return Response.json({ error: 'Você não pode excluir a si mesmo.' }, { status: 400 })

      const { data: alvo, error: ae } = await ctx.supabaseAdmin
        .from('perfis').select('id,role,estabelecimento_id,nome,email').eq('id', profissionalId).maybeSingle()
      if (ae) return Response.json({ error: `Profissional: ${ae.message}` }, { status: 500 })
      if (!alvo || alvo.role !== 'profissional') return Response.json({ error: 'Profissional não encontrado.' }, { status: 404 })
      if (quem.role === 'admin_estabelecimento' && alvo.estabelecimento_id !== quem.estabelecimento_id) {
        return Response.json({ error: 'Este profissional não pertence à sua unidade.' }, { status: 403 })
      }

      // O histórico (atendimentos, pontuações, resgates) referencia o profissional_id mas não
      // tem chave estrangeira para "perfis" — então a exclusão não apaga nem quebra o histórico
      // já registrado, apenas remove o login e o cadastro do profissional.
      const { error: pe } = await ctx.supabaseAdmin.from('perfis').delete().eq('id', profissionalId)
      if (pe) return Response.json({ error: `Perfil: ${pe.message}` }, { status: 500 })

      const { error: ue } = await ctx.supabaseAdmin.auth.admin.deleteUser(profissionalId)
      if (ue) console.error('Exclusão do login do profissional:', ue.message)

      const { error: aue } = await ctx.supabaseAdmin.from('auditoria_admin').insert({
        estabelecimento_id: alvo.estabelecimento_id, ator_id: uid, evento: 'exclusão', entidade: 'profissionais', entidade_id: profissionalId,
        detalhes: { profissional_id: profissionalId, nome: alvo.nome, email: alvo.email }
      })
      if (aue) console.error('Auditoria exclusão profissional:', aue.message)

      return Response.json({ ok: true })
    } catch (err) {
      console.error('excluir-profissional:', err)
      return Response.json({ error: `Falha inesperada: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
  })
}
