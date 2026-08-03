// ==========================================================
// YANSIX INTELLIGENCE ENGINE
// MOTOR DE DIAGNÓSTICO DIGITAL
// VERSÃO 7.0.1
// ==========================================================


const ENGINE = {


answers: [],



// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


init(){

    this.answers=[];

},







// ==========================================================
// ADICIONAR RESPOSTA
// ==========================================================


addAnswer(perguntaId,opcaoIndex){



    const pergunta = QUESTIONS.find(

        q => q.id === perguntaId

    );



    if(!pergunta){

        console.error(
            "Pergunta não encontrada:",
            perguntaId
        );

        return;

    }




    const opcao =

    pergunta.opcoes[opcaoIndex];




    if(!opcao){

        console.error(
            "Opção inválida"
        );

        return;

    }





    this.answers.push({



        perguntaId:

        pergunta.id,



        pergunta:

        pergunta.pergunta || "",



        pilar:

        pergunta.pilar || "Geral",



        categoria:

        pergunta.categoria || "",



        resposta:

        opcao.texto || "",



        pontos:

        Number(opcao.pontos || 0),



        impacto:

        opcao.impacto || ""



    });



},

// ==========================================================
// DEFINIR / SUBSTITUIR RESPOSTA
// ==========================================================

setAnswer(perguntaId, opcaoIndex){

    // Remove resposta anterior desta pergunta

    this.answers = this.answers.filter(

        item => item.perguntaId !== perguntaId

    );

    // Grava a nova resposta

    this.addAnswer(

        perguntaId,

        opcaoIndex

    );

},





// ==========================================================
// LIMPAR
// ==========================================================


clear(){

    this.answers=[];

},







// ==========================================================
// PONTUAÇÃO
// ==========================================================


calculatePoints(){



    return this.answers.reduce(


        (total,item)=>{


            return total +

            Number(item.pontos || 0);



        },


        0


    );



},







// ==========================================================
// SCORE 0-100
// ==========================================================


calculateScore(){



    const totalPerguntas =

    QUESTIONS.length;




    const minimo =

    totalPerguntas * 1;



    const maximo =

    totalPerguntas * 4;




    const pontos =

    this.calculatePoints();





    if(maximo===minimo){

        return 0;

    }





    let score =



    ((pontos-minimo)

    /

    (maximo-minimo))

    *100;





    score=Math.round(score);





    return Math.max(

        0,

        Math.min(

            100,

            score

        )

    );



},







// ==========================================================
// PILARES
// ==========================================================


calculatePilares(){



    const pilares={};





    this.answers.forEach(item=>{





        const nomePilar =

        item.pilar || "Geral";






        if(!pilares[nomePilar]){



            pilares[nomePilar]={



                pontos:0,


                quantidade:0,


                percentual:0,


                respostas:[],


                perguntas:[]



            };



        }







        pilares[nomePilar].pontos +=

        item.pontos;





        pilares[nomePilar].quantidade++;





        pilares[nomePilar].respostas.push(item);





        pilares[nomePilar].perguntas.push(

            item.pergunta

        );





    });








    Object.keys(pilares)

    .forEach(nome=>{





        const dados =

        pilares[nome];






        const minimo =

        dados.quantidade * 1;




        const maximo =

        dados.quantidade * 4;







        if(maximo===minimo){



            dados.percentual=0;



        }

        else{



            dados.percentual=Math.round(



                ((dados.pontos-minimo)

                /

                (maximo-minimo))

                *100



            );



        }





    });







    return pilares;



},







// ==========================================================
// PONTOS FORTES
// ==========================================================


analisarPontosFortes(){



    return this.answers.filter(


        item =>

        item.pontos >=3


    );



},







// ==========================================================
// OPORTUNIDADES
// ==========================================================


analisarOportunidades(){



    return this.answers.filter(


        item =>

        item.pontos <=2


    );



},







// ==========================================================
// RESUMO PILARES
// ==========================================================


gerarResumoPilares(pilares){



return Object.keys(pilares)

.map(nome=>{



    const dados = pilares[nome];



    let status;





    if(dados.percentual <=40){



        status="Necessita evolução";



    }

    else if(dados.percentual <=70){



        status="Em desenvolvimento";



    }

    else{



        status="Bom nível estratégico";



    }







    return {



        pilar:nome,



        percentual:dados.percentual,



        status:status,



        quantidade:dados.quantidade,



        perguntasAvaliadas:dados.quantidade,



        perguntas:dados.perguntas,



        respostas:dados.respostas



    };



});



},







// ==========================================================
// RELATÓRIO FINAL
// ==========================================================


generateReport(){





const score =

this.calculateScore();






let nivel =

obterNivel(score);







if(!nivel){



    nivel={



        id:0,


        nome:"Não definido",


        nomeCompleto:"",


        emoji:"",


        tituloResultado:"Diagnóstico YANSIX",


        descricao:"",


        descricaoComercial:"",


        produtoIndicado:"",


        indicacao:""



    };



}








const pilares =

this.calculatePilares();









return {



score:



score,





pontuacaoReal:



this.calculatePoints(),







nivel:



nivel.id,







nomeNivel:



nivel.nome,







nomeCompleto:



nivel.nomeCompleto,







emoji:



nivel.emoji,









tituloResultado:



nivel.tituloResultado,







titulo:



nivel.tituloResultado,









descricao:



nivel.descricao,







descricaoComercial:



nivel.descricaoComercial,









produtoIndicado:



nivel.produtoIndicado,







indicacao:



nivel.indicacao,









pilares:



pilares,








resumoPilares:



this.gerarResumoPilares(pilares),









pontosFortes:



this.analisarPontosFortes(),









oportunidades:



this.analisarOportunidades(),









respostas:



this.answers





};



},







// ==========================================================
// COMPATIBILIDADE
// ==========================================================


generate(){


    return this.generateReport();


},







loadAnswers(respostas){



    if(Array.isArray(respostas)){


        this.answers=respostas;


    }



},







hasAnswers(){


    return this.answers.length>0;


},







exportResult(){


    return this.generateReport();


}





};









// ==========================================================
// START
// ==========================================================


ENGINE.init();





window.ENGINE=ENGINE;