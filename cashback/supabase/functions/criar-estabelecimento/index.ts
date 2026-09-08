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

      const { data: perfil, error: perfilError } = await ctx.supabaseAdmin.from('perfis').select('id,role').eq('id', uid).maybeSingle()
      if (perfilError) return Response.json({ error: `Perfil: ${perfilError.message}` }, { status: 500 })
      if (!perfil || perfil.role !== 'admin_master') return Response.json({ error: 'Apenas o Admin Master pode criar estabelecimentos.' }, { status: 403 })

      const { count, error: ce } = await ctx.supabaseAdmin.from('estabelecimentos').select('id', { count: 'exact', head: true })
      if (ce) return Response.json({ error: `Limite: ${ce.message}` }, { status: 500 })
      if ((count ?? 0) >= 10) return Response.json({ error: 'A plataforma permite no máximo 10 estabelecimentos.', codigo: 'LIMITE_ESTABELECIMENTOS' }, { status: 409 })

      const b = await req.json()
      const nome = String(b?.nome_estabelecimento ?? '').trim()
      const nomeAdmin = String(b?.nome_admin ?? '').trim()
      const email = String(b?.email ?? '').trim().toLowerCase()
      const senha = String(b?.senha ?? '')
      if (!nome || !nomeAdmin || !email || !senha) return Response.json({ error: 'Preencha estabelecimento, administrador, e-mail e senha.' }, { status: 400 })
      if (senha.length < 6) return Response.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })

      const { data: novoUsuario, error: authError } = await ctx.supabaseAdmin.auth.admin.createUser({
        email, password: senha, email_confirm: true,
        user_metadata: { nome: nomeAdmin, tipo: 'admin_estabelecimento' }
      })
      if (authError || !novoUsuario.user) {
        const msg = authError?.message || 'não foi possível criar o administrador.'
        const duplicate = /already|exist|registered|duplicate|cadastrad/i.test(msg)
        return Response.json({ error: duplicate ? 'Este e-mail de administrador já está cadastrado no Supabase Auth. Use outro e-mail.' : `Auth: ${msg}` }, { status: 400 })
      }

      const newUid = novoUsuario.user.id
      const payload = {
        owner_id: newUid, nome,
        cor_tema: String(b?.cor_tema ?? '#5B3DF5').trim() || '#5B3DF5',
        documento: String(b?.documento ?? '').trim() || null,
        telefone: String(b?.telefone ?? '').trim() || null,
        email: String(b?.email_estabelecimento ?? '').trim().toLowerCase() || null,
        endereco: String(b?.endereco ?? '').trim() || null,
        horario_funcionamento: String(b?.horario_funcionamento ?? '').trim() || null,
        area_atuacao: String(b?.area_atuacao ?? '').trim() || null,
        status: 'ativo'
      }
      const { data: novoEstab, error: estabError } = await ctx.supabaseAdmin.from('estabelecimentos').insert(payload).select('id').single()
      if (estabError || !novoEstab) {
        await ctx.supabaseAdmin.auth.admin.deleteUser(newUid)
        return Response.json({ error: `Estabelecimento: ${estabError?.message || 'não criado.'}` }, { status: 500 })
      }

      const { error: cfgError } = await ctx.supabaseAdmin.from('configuracoes').upsert({ estabelecimento_id: novoEstab.id }, { onConflict: 'estabelecimento_id' })
      if (cfgError) {
        await ctx.supabaseAdmin.from('estabelecimentos').delete().eq('id', novoEstab.id)
        await ctx.supabaseAdmin.auth.admin.deleteUser(newUid)
        return Response.json({ error: `Configurações: ${cfgError.message}` }, { status: 500 })
      }

      const { error: perfilAdminError } = await ctx.supabaseAdmin.from('perfis').insert({ id: newUid, role: 'admin_estabelecimento', estabelecimento_id: novoEstab.id, nome: nomeAdmin })
      if (perfilAdminError) {
        await ctx.supabaseAdmin.from('configuracoes').delete().eq('estabelecimento_id', novoEstab.id)
        await ctx.supabaseAdmin.from('estabelecimentos').delete().eq('id', novoEstab.id)
        await ctx.supabaseAdmin.auth.admin.deleteUser(newUid)
        return Response.json({ error: `Perfil: ${perfilAdminError.message}` }, { status: 500 })
      }

      const { error: ae } = await ctx.supabaseAdmin.from('auditoria_admin').insert({
        estabelecimento_id: novoEstab.id, ator_id: uid, evento: 'criação', entidade: 'estabelecimentos', entidade_id: novoEstab.id,
        detalhes: { administrador_id: newUid, nome }
      })
      if (ae) console.error('Auditoria estabelecimento:', ae.message)

      return Response.json({ ok: true, estabelecimento_id: novoEstab.id, user_id: newUid })
    } catch (err) {
      console.error('criar-estabelecimento:', err)
      return Response.json({ error: `Falha inesperada: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }
  })
}
