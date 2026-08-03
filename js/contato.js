// ==========================================================
// YANSIX
// CONTATO / ENVIO GOOGLE SHEETS
// VERSÃO 7.1.0
// ==========================================================



const GOOGLE_SHEETS_URL =

"https://script.google.com/macros/s/AKfycbxWinB6ynyJsmoGwywHzDKJwwsP2-x-QuhOnank0GG8AyKsg-xk5GHfV_E3XOHGO_2Auw/exec";









// ==========================================================
// INICIALIZAÇÃO
// ==========================================================


document.addEventListener(

"DOMContentLoaded",

function(){



    carregarResumoDiagnostico();





    const form =

    document.getElementById(

        "formContato"

    );






    if(form){



        form.addEventListener(

            "submit",

            function(e){



                e.preventDefault();



                enviarDados();



            }

        );



    }



}

);











// ==========================================================
// CARREGAR RESUMO
// ==========================================================


function carregarResumoDiagnostico(){



const usuario = JSON.parse(


localStorage.getItem(

"usuarioYansix"

)


)

|| {};








const resultado =

usuario.resultado || {};








const nivel =

document.getElementById(

"resumoNivel"

);





if(nivel){



nivel.innerHTML =


resultado.nomeCompleto ||


resultado.nomeNivel ||


"-";



}









const score =

document.getElementById(

"resumoScore"

);





if(score){



score.innerHTML =


(resultado.score || 0) + "%";



}









const indicacao =

document.getElementById(

"resumoIndicacao"

);





if(indicacao){



indicacao.innerHTML =


resultado.indicacao ||


resultado.produtoIndicado ||


"-";



}



}











// ==========================================================
// PEGAR VALOR
// ==========================================================


function pegarValor(id){



const campo =

document.getElementById(id);




return campo ?


campo.value.trim()


:

"";



}











// ==========================================================
// ENVIO
// ==========================================================


function enviarDados(){



const botao =

document.querySelector(

"#formContato button[type='submit']"

);






if(botao){



    botao.disabled = true;



    botao.innerHTML =



    "Enviando análise...";



}









const mensagem =

document.getElementById(

"mensagem"

);






if(mensagem){



mensagem.innerHTML =



`

<div class="loading-message">


⏳ Estamos preparando sua análise estratégica.


<br><br>


Aguarde alguns segundos enquanto enviamos suas informações com segurança.


</div>


`;



}









const usuario = JSON.parse(


localStorage.getItem(

"usuarioYansix"

)


)

|| {};









const resultado =

usuario.resultado || {};









// objetivo vem do contato.html

const objetivoContato =


pegarValor(

"objetivo"

)

||


usuario.objetivo

||


"";











const lead = {







// IDENTIFICAÇÃO


versao:

"7.1.0",



origem:

"Diagnóstico Inteligente YANSIX",



data:

new Date()

.toLocaleString("pt-BR"),









// CONTATO


nome:

pegarValor("nome"),



empresa:

pegarValor("empresa"),



whatsapp:

pegarValor("whatsapp"),



email:

pegarValor("email"),









// COMERCIAL


horario:

pegarValor("horario"),



observacao:

pegarValor("observacao"),







// PERFIL EMPRESA


objetivo:

objetivoContato,



perfil:

usuario.perfil || "",









// RESULTADO


nivel:

resultado.nivel || "",



nomeNivel:

resultado.nomeNivel || "",



nomeCompleto:

resultado.nomeCompleto || "",



emoji:

resultado.emoji || "",



score:

resultado.score || 0,



pontuacaoReal:

resultado.pontuacaoReal || 0,








// ANÁLISE


tituloResultado:

resultado.tituloResultado ||


resultado.titulo ||


"",





descricao:

resultado.descricao || "",





descricaoComercial:

resultado.descricaoComercial || "",









// RECOMENDAÇÃO


produtoIndicado:

resultado.produtoIndicado || "",



indicacao:

resultado.indicacao || "",







// INTELIGÊNCIA


pilares:

JSON.stringify(

resultado.pilares || {}

),



resumoPilares:

JSON.stringify(

resultado.resumoPilares || []

),



pontosFortes:

JSON.stringify(

resultado.pontosFortes || []

),



oportunidades:

JSON.stringify(

resultado.oportunidades || []

),









// RESPOSTAS


respostas:

usuario.respostas || []



};









console.log(

"Dados enviados YANSIX:",

lead

);











fetch(

GOOGLE_SHEETS_URL,

{



method:"POST",



headers:{



"Content-Type":

"text/plain;charset=utf-8"



},



body:

JSON.stringify(lead)



}

)









.then(

response => response.json()

)









.then(

retorno=>{



console.log(

"Retorno Google Sheets:",

retorno

);







if(retorno.status==="ok"){



sucessoEnvio();



localStorage.removeItem(

"usuarioYansix"

);



}

else{



erroEnvio();



}



}

)











.catch(

erro=>{



console.error(

"Erro envio:",

erro

);



erroEnvio();



}

);



}











// ==========================================================
// SUCESSO
// ==========================================================


function sucessoEnvio(){



const mensagem =

document.getElementById(

"mensagem"

);





if(mensagem){



mensagem.innerHTML =



`

<div class="success-message">


✅ Estratégia enviada com sucesso.


<br><br>


Um especialista YANSIX entrará em contato em breve.


</div>


`;



}



}











// ==========================================================
// ERRO
// ==========================================================


function erroEnvio(){



const mensagem =

document.getElementById(

"mensagem"

);





if(mensagem){



mensagem.innerHTML =



`

<div class="error-message">


❌ Não foi possível enviar sua solicitação.


<br><br>


Tente novamente.


</div>


`;



}



const botao =

document.querySelector(

"#formContato button[type='submit']"

);





if(botao){



botao.disabled = false;



botao.innerHTML =

"Enviar diagnóstico";



}



}