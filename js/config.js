// ==========================================================
// YANSIX
// CONFIGURAÇÃO DE NÍVEIS
// VERSÃO 6.0.7
// ==========================================================


const NIVEIS = [



{
id:1,

nome:"Iniciante",

nomeCompleto:
"Nível 1 • Iniciante 🌱",

emoji:"🌱",

minimo:0,

maximo:20,


produtoIndicado:
"Consultoria Estratégica Digital",


indicacao:
"Construção da presença digital e estrutura estratégica.",



tituloResultado:
"Sua empresa está iniciando sua jornada digital.",



descricao:
"Sua empresa ainda possui pouca maturidade digital. Este é o momento ideal para construir uma base sólida, aumentar visibilidade e criar autoridade.",



descricaoComercial:
"A prioridade é estruturar corretamente sua presença digital e criar fundamentos para crescimento."
},






{
id:2,

nome:"Básico",

nomeCompleto:
"Nível 2 • Básico 🚀",

emoji:"🚀",

minimo:21,

maximo:40,


produtoIndicado:
"Website Estratégico",


indicacao:
"Construção de autoridade e presença digital profissional.",



tituloResultado:
"Sua empresa já possui presença digital.",



descricao:
"Sua empresa possui alguns ativos digitais, porém ainda existem oportunidades para melhorar confiança, posicionamento e comunicação.",



descricaoComercial:
"Uma estrutura digital profissional pode aumentar credibilidade e gerar novas oportunidades."
},







{
id:3,

nome:"Intermediário",

nomeCompleto:
"Nível 3 • Intermediário ⭐",

emoji:"⭐",

minimo:41,

maximo:60,


produtoIndicado:
"Reposicionamento Digital + Landing Page",


indicacao:
"Otimização de posicionamento e conversão.",



tituloResultado:
"Sua empresa possui uma estrutura digital em evolução.",



descricao:
"Sua empresa apresenta uma base digital organizada, mas ainda pode melhorar conversão, relacionamento e geração de oportunidades.",



descricaoComercial:
"O próximo passo é transformar presença digital em resultados comerciais."
},








{
id:4,

nome:"Avançado",

nomeCompleto:
"Nível 4 • Avançado 💎",

emoji:"💎",

minimo:61,

maximo:80,


produtoIndicado:
"Automação Inteligente",


indicacao:
"Automação de processos e ganho de escala.",



tituloResultado:
"Sua empresa possui maturidade digital estratégica.",



descricao:
"Sua empresa utiliza boas práticas digitais e possui potencial para crescer através de automação e inteligência.",



descricaoComercial:
"O foco agora é reduzir processos manuais e aumentar eficiência operacional."
},








{
id:5,

nome:"Máximo",

nomeCompleto:
"Nível 5 • Máximo 👑",

emoji:"👑",

minimo:81,

maximo:100,


produtoIndicado:
"Escala com Inteligência Artificial",


indicacao:
"Expansão utilizando IA, dados e automação.",



tituloResultado:
"Sua empresa atingiu alta maturidade digital.",



descricao:
"Sua empresa possui uma operação digital inteligente, integrada e preparada para crescimento.",



descricaoComercial:
"O próximo estágio é utilizar inteligência artificial como vantagem competitiva."
}



];






// ==========================================================
// BUSCAR NÍVEL
// ==========================================================


function obterNivel(score){


    return NIVEIS.find(


        nivel =>

        score >= nivel.minimo &&

        score <= nivel.maximo


    )

    ||

    NIVEIS[0];


}




window.NIVEIS = NIVEIS;

window.obterNivel = obterNivel;