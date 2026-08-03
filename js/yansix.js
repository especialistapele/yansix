// ==========================================================
// YANSIX INTELLIGENCE ENGINE
// NÚCLEO PRINCIPAL DA APLICAÇÃO
// VERSÃO 7.1.0
// ==========================================================


const Yansix = {



// ==========================================================
// VERSÃO
// ==========================================================


versao:"7.1.0",







// ==========================================================
// USUÁRIO
// ==========================================================


usuario:{



    nome:"",

    empresa:"",

    whatsapp:"",

    email:"",



    objetivo:"",

    perfil:"",



    respostas:[],


    resultado:{},



    dataInicio:"",

    dataFinalizacao:"",



    finalizado:false



},







// ==========================================================
// INICIAR
// ==========================================================


iniciar(){



    this.carregar();





    if(!this.usuario.dataInicio){



        this.usuario.dataInicio =


        new Date()

        .toLocaleString("pt-BR");



        this.salvar();



    }



},







// ==========================================================
// SALVAR
// ==========================================================


salvar(){



    localStorage.setItem(


        "usuarioYansix",


        JSON.stringify(this.usuario)



    );



},







// ==========================================================
// CARREGAR
// ==========================================================


carregar(){



    const dados =


    localStorage.getItem(

        "usuarioYansix"

    );





    if(dados){



        this.usuario =


        JSON.parse(dados);



    }



},







// ==========================================================
// CADASTRO
// ==========================================================


atualizarCadastro(dados){



    this.usuario.nome =

    dados.nome || "";



    this.usuario.empresa =

    dados.empresa || "";



    this.usuario.whatsapp =

    dados.whatsapp || "";



    this.usuario.email =

    dados.email || "";




    this.salvar();



},







// ==========================================================
// OBJETIVO
// ==========================================================


definirObjetivo(objetivo){



    this.usuario.objetivo =

    objetivo;



    this.salvar();



},







// ==========================================================
// PERFIL AUTOMÁTICO
// ==========================================================


gerarPerfilAutomatico(score){



    let perfil = "";





    if(score <= 30){



        perfil =

        "Empresa iniciando sua estrutura digital";



    }

    else if(score <= 60){



        perfil =

        "Empresa em desenvolvimento digital";



    }

    else if(score <= 80){



        perfil =

        "Empresa com presença digital estruturada";



    }

    else{



        perfil =

        "Empresa preparada para expansão digital";



    }






    return perfil;



},







// ==========================================================
// PERFIL
// ==========================================================


gerarPerfil(){



    if(this.usuario.objetivo){



        this.usuario.perfil =


        "Perfil YANSIX - " +

        this.usuario.objetivo;



    }

    else{



        this.usuario.perfil =


        "Perfil YANSIX";



    }




    this.salvar();



    return this.usuario.perfil;



},







// ==========================================================
// GERAR DIAGNÓSTICO
// ==========================================================


gerarDiagnostico(){



    const resultado =


    ENGINE.generateReport();







    this.usuario.resultado = {



        score:

        resultado.score,



        pontuacaoReal:

        resultado.pontuacaoReal,





        nivel:

        resultado.nivel,



        nomeNivel:

        resultado.nomeNivel,



        nomeCompleto:


        `Nível ${resultado.nivel} • ${resultado.nomeNivel} ${resultado.emoji || ""}`,



        emoji:

        resultado.emoji,





        tituloResultado:

        resultado.tituloResultado || resultado.titulo || "",



        titulo:

        resultado.tituloResultado || resultado.titulo || "",





        descricao:

        resultado.descricao || "",





        descricaoComercial:

        resultado.descricaoComercial || "",






        produtoIndicado:

        resultado.produtoIndicado || resultado.indicacao || "",



        indicacao:

        resultado.indicacao || "",






        pilares:

        resultado.pilares || {},



        resumoPilares:

        resultado.resumoPilares || [],



        pontosFortes:

        resultado.pontosFortes || [],



        oportunidades:

        resultado.oportunidades || [],






        respostas:

        resultado.respostas || []



    };








    // ======================================================
    // GERA PERFIL AUTOMÁTICO
    // ======================================================


    this.usuario.perfil =


    this.gerarPerfilAutomatico(

        resultado.score

    );








    this.usuario.respostas =


    resultado.respostas || [];







    this.usuario.versao =


    this.versao;







    this.usuario.finalizado = true;








    this.usuario.dataFinalizacao =


    new Date()

    .toLocaleString("pt-BR");








    this.salvar();








    return this.usuario.resultado;



},







// ==========================================================
// EXPORTAR DADOS
// ==========================================================


exportarDados(){



    return {



        versao:

        this.versao,



        dataInicio:

        this.usuario.dataInicio,



        dataFinalizacao:

        this.usuario.dataFinalizacao,



        nome:

        this.usuario.nome,



        empresa:

        this.usuario.empresa,



        whatsapp:

        this.usuario.whatsapp,



        email:

        this.usuario.email,



        objetivo:

        this.usuario.objetivo,



        perfil:

        this.usuario.perfil,



        resultado:

        this.usuario.resultado



    };



},







// ==========================================================
// LIMPAR
// ==========================================================


limpar(){



    localStorage.removeItem(

        "usuarioYansix"

    );






    this.usuario = {



        nome:"",

        empresa:"",

        whatsapp:"",

        email:"",



        objetivo:"",

        perfil:"",



        respostas:[],



        resultado:{},



        dataInicio:"",



        dataFinalizacao:"",



        finalizado:false



    };



}





};







// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


Yansix.iniciar();






// Compatibilidade global


window.Yansix = Yansix;