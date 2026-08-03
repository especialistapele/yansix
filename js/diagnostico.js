// =====================================
// YANSIX
// DIAGNÓSTICO DE PRESENÇA DIGITAL
// VERSÃO 6.0.4
// =====================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const btnStart =
            document.getElementById("btnStart");

        if (btnStart) {

            btnStart.addEventListener(
                "click",
                iniciarDiagnostico
            );

        }

    }
);


// =====================================
// INICIAR DIAGNÓSTICO
// =====================================

function iniciarDiagnostico() {

    // Limpa qualquer diagnóstico anterior
    localStorage.removeItem("usuarioYansix");

    // Cria uma nova sessão
    const usuario = {

        versao: "6.0.4",

        nome: "",
        empresa: "",
        whatsapp: "",
        email: "",

        objetivo: "",
        perfil: "",

        respostas: [],

        resultado: {},

        dataInicio:
            new Date().toLocaleString("pt-BR"),

        dataFinalizacao: "",

        finalizado: false

    };

    localStorage.setItem(
        "usuarioYansix",
        JSON.stringify(usuario)
    );

    console.log(
        "Nova sessão YANSIX iniciada.",
        usuario
    );

    // Inicia o questionário
    window.location.href = "questionario.html";

}