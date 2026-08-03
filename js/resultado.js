// ==========================================================
// YANSIX
// RESULTADO DO DIAGNÓSTICO
// VERSÃO 7.0.1
// ==========================================================



document.addEventListener(

"DOMContentLoaded",

function(){

    carregarResultado();

}

);







// ==========================================================
// CARREGAR RESULTADO
// ==========================================================


function carregarResultado(){


    const usuario = JSON.parse(

        localStorage.getItem(

            "usuarioYansix"

        )

    );





    if(!usuario || !usuario.resultado){


        console.error(

            "Nenhum diagnóstico encontrado."

        );


        window.location.href =

        "questionario.html";


        return;


    }






    const resultado =

    usuario.resultado;





    console.log(

        "Resultado YANSIX:",

        resultado

    );






    preencherNivel(resultado);


    preencherScore(resultado);


    preencherAnalise(resultado);


    preencherIndicacao(resultado);


    preencherPilares(resultado);


    preencherPontosFortes(resultado);


    preencherOportunidades(resultado);



}









// ==========================================================
// NÍVEL
// ==========================================================


function preencherNivel(resultado){



    const nivel =

    document.getElementById(

        "nivel"

    );



    if(nivel){


        nivel.innerHTML =


        `Nível ${resultado.nivel || ""}`;


    }






    const emoji =

    document.getElementById(

        "emoji"

    );



    if(emoji){


        emoji.innerHTML =


        resultado.emoji || "";


    }






    const nome =

    document.getElementById(

        "nomeNivel"

    );



    if(nome){


        nome.innerHTML =


        resultado.nomeCompleto ||


        resultado.nomeNivel ||


        "";


    }


}









// ==========================================================
// SCORE
// ==========================================================


function preencherScore(resultado){



    const score =

    document.getElementById(

        "score"

    );



    if(score){


        score.innerHTML =


        `${resultado.score || 0}%`;


    }


}









// ==========================================================
// ANÁLISE
// ==========================================================


function preencherAnalise(resultado){



    const titulo =

    document.getElementById(

        "tituloResultado"

    );



    if(titulo){


        titulo.innerHTML =


        resultado.tituloResultado ||


        resultado.titulo ||


        "Diagnóstico YANSIX";


    }







    const descricao =

    document.getElementById(

        "descricao"

    );



    if(descricao){


        descricao.innerHTML =


        resultado.descricao || "";


    }



}









// ==========================================================
// INDICAÇÃO
// ==========================================================


function preencherIndicacao(resultado){



    const indicacao =

    document.getElementById(

        "indicacao"

    );



    if(indicacao){


        indicacao.innerHTML =


        resultado.produtoIndicado ||


        resultado.indicacao ||


        "";


    }



}









// ==========================================================
// PILARES AVALIADOS
// ==========================================================


function preencherPilares(resultado){



    const container =

    document.getElementById(

        "pilares"

    );



    if(!container){

        return;

    }






    container.innerHTML = "";





    let pilares = [];






    // NOVA ESTRUTURA ENGINE 7.0.1

    if(

        Array.isArray(

            resultado.resumoPilares

        )

    ){



        pilares =

        resultado.resumoPilares;



    }








    // COMPATIBILIDADE COM VERSÕES ANTIGAS

    if(!pilares.length && resultado.pilares){



        Object.keys(resultado.pilares)

        .forEach(nome=>{



            const p =

            resultado.pilares[nome];





            pilares.push({



                pilar:nome,


                percentual:p.percentual || 0,


                status:

                p.percentual <=40

                ?

                "Necessita evolução"


                :


                p.percentual <=70

                ?

                "Em desenvolvimento"


                :

                "Bom nível estratégico",



                perguntasAvaliadas:

                p.quantidade || 0,



                respostas:

                p.respostas || []



            });



        });



    }








    if(!pilares.length){



        container.innerHTML =


        "<p>Nenhum pilar avaliado encontrado.</p>";



        return;


    }








    pilares.forEach(p=>{



        const div =

        document.createElement(

            "div"

        );



        div.className =

        "pillar-item";






        const quantidade =


        p.perguntasAvaliadas ||


        p.quantidade ||


        0;






        div.innerHTML =



        `

        <strong>

        ${p.pilar}

        </strong>


        <span>

        ${p.percentual}% -

        ${p.status}

        </span>


        <small>

        ${quantidade}

        perguntas avaliadas

        </small>

        `;





        container.appendChild(div);



    });



}









// ==========================================================
// PONTOS FORTES
// ==========================================================


function preencherPontosFortes(resultado){



    const lista =

    document.getElementById(

        "pontosFortes"

    );



    if(!lista){

        return;

    }






    lista.innerHTML = "";






    const fortes =

    resultado.pontosFortes || [];






    if(!fortes.length){



        lista.innerHTML =


        "<li>Nenhum ponto forte identificado.</li>";



        return;


    }








    fortes.forEach(item=>{



        const li =

        document.createElement(

            "li"

        );






        li.innerHTML =



        `

        <strong>

        ${item.pilar || "Área"}

        </strong>


        <br>


        Pergunta:

        ${item.pergunta || ""}


        <br>


        Resposta:

        ${item.resposta || ""}


        <br>


        <small>

        Pontuação:

        ${item.pontos || 0}

        |

        Impacto:

        ${item.impacto || "Positivo"}

        </small>

        `;





        lista.appendChild(li);



    });



}









// ==========================================================
// OPORTUNIDADES
// ==========================================================


function preencherOportunidades(resultado){



    const lista =

    document.getElementById(

        "oportunidades"

    );



    if(!lista){

        return;

    }






    lista.innerHTML = "";






    const oportunidades =

    resultado.oportunidades || [];








    if(!oportunidades.length){



        lista.innerHTML =


        "<li>Nenhuma oportunidade identificada.</li>";



        return;


    }








    oportunidades.forEach(item=>{



        const li =

        document.createElement(

            "li"

        );






        li.innerHTML =



        `

        <strong>

        ${item.pilar || "Área"}

        </strong>


        <br>


        Pergunta:

        ${item.pergunta || ""}


        <br>


        Situação:

        ${item.resposta || ""}


        <br>


        <small>

        Pontuação:

        ${item.pontos || 0}

        |

        Impacto:

        ${item.impacto || "Melhoria estratégica"}

        </small>

        `;






        lista.appendChild(li);



    });



}









// ==========================================================
// CTA
// ==========================================================


function solicitarEspecialista(){



    window.location.href =


    "contato.html";



}