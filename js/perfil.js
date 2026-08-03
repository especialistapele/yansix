// =====================================
// YANSIX
// PERFIL DA EMPRESA
// VERSÃO 7.0.1
// =====================================



document.addEventListener(

"DOMContentLoaded",

function(){


const formulario =

document.getElementById(

"formPerfil"

);



if(formulario){



formulario.addEventListener(

"submit",

function(e){



e.preventDefault();



salvarPerfil();



}



);



}



}

);









// =====================================
// SALVAR PERFIL
// =====================================


function salvarPerfil(){





const dadosPerfil = {




nome:

document

.getElementById("nome")

.value

.trim(),





empresa:

document

.getElementById("empresa")

.value

.trim(),





segmento:

document

.getElementById("segmento")

.value

.trim(),





cargo:

document

.getElementById("cargo")

.value

.trim(),





funcionarios:

document

.getElementById("funcionarios")

.value,





site:

document

.getElementById("site")

.value

.trim(),





instagram:

document

.getElementById("instagram")

.value

.trim(),





googleNegocio:

document

.getElementById("googleNegocio")

.value,





objetivo:

document

.getElementById("objetivo")

.value





};









// ==================================================
// ENVIA PARA O NÚCLEO YANSIX
// ==================================================


if(window.Yansix){



Yansix.salvarPerfilEmpresa(

dadosPerfil

);



}

else{



console.error(

"Yansix.js não carregado."

);



return;



}









console.log(

"Perfil YANSIX salvo:",

dadosPerfil

);









// Continua diagnóstico


window.location.href =

"questionario.html";



}