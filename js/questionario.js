// ==========================================================
// YANSIX
// CONTROLE DO QUESTIONÁRIO INTELIGENTE
// VERSÃO 7.0.0
// ==========================================================



document.addEventListener(

"DOMContentLoaded",

function(){


    iniciarQuestionario();


}

);









// ==========================================================
// VARIÁVEIS GLOBAIS
// ==========================================================


let perguntaAtual = 0;


let respostaSelecionada = false;









// ==========================================================
// INICIAR QUESTIONÁRIO
// ==========================================================


function iniciarQuestionario(){



    // Limpa respostas antigas do motor


    ENGINE.clear();






    // Limpa apenas diagnóstico anterior
    // mantendo perfil da empresa


    if(window.Yansix){



        Yansix.usuario.respostas = [];



        Yansix.usuario.resultado = {};



        Yansix.usuario.finalizado = false;



        Yansix.salvar();



    }






    perguntaAtual = 0;



    respostaSelecionada = false;






    carregarPergunta();



}











// ==========================================================
// CARREGAR PERGUNTA ATUAL
// ==========================================================


function carregarPergunta(){



    const pergunta =

    QUESTIONS[perguntaAtual];






    if(!pergunta){



        finalizarQuestionario();


        return;



    }







    respostaSelecionada = false;






    atualizarProgresso();






    mostrarPergunta(

        pergunta

    );






}











// ==========================================================
// ATUALIZAR PROGRESSO
// ==========================================================


function atualizarProgresso(){



    const contador =

    document.getElementById(

        "contador"

    );






    const barra =

    document.getElementById(

        "barra"

    );








    if(contador){



        contador.innerHTML =



        `Pergunta ${perguntaAtual + 1} de ${QUESTIONS.length}`;



    }








    if(barra){



        const percentual =



        ((perguntaAtual)

        /

        QUESTIONS.length)

        *

        100;






        barra.style.width =



        percentual + "%";



    }



}











// ==========================================================
// MOSTRAR PERGUNTA
// ==========================================================


function mostrarPergunta(pergunta){



    const titulo =

    document.getElementById(

        "pergunta"

    );






    const opcoes =

    document.getElementById(

        "opcoes"

    );






    const resposta =

    document.getElementById(

        "resposta"

    );






    const botao =

    document.getElementById(

        "btnProximo"

    );







    if(titulo){



        titulo.innerHTML =

        pergunta.pergunta;



    }







    if(opcoes){



        opcoes.innerHTML="";






        pergunta.opcoes.forEach(



            (opcao,index)=>{





                const button =

                document.createElement(

                    "button"

                );






                button.className =

                "option";






                button.dataset.index =

                index;






                button.innerHTML =

                opcao.texto;






                button.addEventListener(



                    "click",



                    function(){





                        selecionarResposta(

                            pergunta,

                            index,

                            opcao,

                            button

                        );




                    }



                );






                opcoes.appendChild(button);





            }



        );






    }








    if(resposta){



        resposta.innerHTML="";



    }








    if(botao){



        botao.style.display="none";



    }



}












// ==========================================================
// SELECIONAR RESPOSTA
// ==========================================================


function selecionarResposta(

    pergunta,

    index,

    opcao,

    botao

){





   document
.querySelectorAll(".option")
.forEach(item => {

    item.classList.remove("selected-option");

    item.style.borderColor = "#dbeafe";
    item.style.background = "#ffffff";

});








   botao.classList.add("selected-option");

   botao.style.borderColor = "#2563eb";

   botao.style.background = "#eff6ff";









    // Salva no motor


   ENGINE.answers = ENGINE.answers.filter(
    item => item.perguntaId !== pergunta.id
);

ENGINE.addAnswer(
    pergunta.id,
    index
);

respostaSelecionada = true;






    // Guarda última resposta


    localStorage.setItem(



        "ultimaRespostaYansix",



        JSON.stringify({



            pergunta:

            perguntaAtual,



            perguntaId:

            pergunta.id,



            resposta:

            opcao.texto,



            pontos:

            opcao.pontos



        })



    );









    const respostaBox =

    document.getElementById(

        "resposta"

    );








    if(respostaBox){



        respostaBox.innerHTML =



        `

        <div class="selected">


        Resposta selecionada:


        <strong>

        ${opcao.texto}

        </strong>


        </div>

        `;



    }









    const botaoProximo =

    document.getElementById(

        "btnProximo"

    );








    if(botaoProximo){



        botaoProximo.style.display="block";



    }






}











// ==========================================================
// PRÓXIMA PERGUNTA
// ==========================================================


document.addEventListener(



"click",



function(e){





    if(

        e.target.id ===

        "btnProximo"

    ){






        perguntaAtual++;






        carregarPergunta();





    }






}

);












// ==========================================================
// FINALIZAR QUESTIONÁRIO
// ==========================================================


function finalizarQuestionario(){





    const barra =

    document.getElementById(

        "barra"

    );






    if(barra){



        barra.style.width="100%";



    }








    const contador =

    document.getElementById(

        "contador"

    );








    if(contador){



        contador.innerHTML =



        "Diagnóstico concluído";



    }









    // Gera diagnóstico pelo YANSIX


    const resultado =



    Yansix.gerarDiagnostico();









    console.log(



        "Diagnóstico YANSIX finalizado:",



        resultado



    );









    localStorage.setItem(



        "diagnosticoFinalizadoYansix",



        JSON.stringify({



            data:



            new Date()

            .toLocaleString("pt-BR"),




            score:



            resultado.score,




            nivel:



            resultado.nomeNivel



        })



    );









    setTimeout(



        function(){



            window.location.href =



            "resultado.html";



        },



        500



    );





}