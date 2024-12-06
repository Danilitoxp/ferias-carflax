import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyAf1i_2cxfJ8gCemPL0tUeLEZGk2s2nciw",
    authDomain: "carflax-ferias.firebaseapp.com",
    projectId: "carflax-ferias",
    storageBucket: "carflax-ferias.firebasestorage.app",
    messagingSenderId: "200010032965",
    appId: "1:200010032965:web:f5dda20c6f1636ed07c02c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let funcionarios = [];

document.addEventListener('DOMContentLoaded', async function () {
    const diasCalendario = document.getElementById('diasCalendario');
    const mesAno = document.getElementById('mesAno');
    const botaovoltar = document.querySelector('#voltar');
    const modal = document.querySelector('.modal');
    const btnAdicionarFuncionario = document.getElementById('adicionarFuncionarioBtn');
    const formAdicionarFuncionario = document.getElementById('form-adicionar-funcionario');
    const funcionariosContainer = document.querySelector('.funcionarios');
    const botaoAvancar = document.getElementById('avancar');
    const botaoHoje = document.getElementById('hoje');
    const btnAdicionarFerias = document.getElementById('adicionarFeriasBtn');


    await carregarFuncionariosDoFirestore();

    const modalFuncionario = document.querySelector(".modal");
    const modalFerias = document.getElementById("modalAdicionarFerias");

    const closeModalFuncionario = document.querySelector(".close-modal");
    const closeModalFerias = document.querySelector(".close-modal-ferias");

    let hoje = new Date();
    let mesAtual = hoje.getMonth(); // Obtém o mês atual (0 = Janeiro, 11 = Dezembro)
    let anoAtual = hoje.getFullYear(); // Obtém o ano atual


    async function calcularDiasFerias(dataInicio, dataFim, nomeFuncionario) {
        const funcionario = funcionarios.find(f => f.nome === nomeFuncionario);
        if (!funcionario) {
            console.error('Funcionário não encontrado!');
            return;
        }

        const dias = [];
        let dataAtual = new Date(dataInicio);

        while (dataAtual <= dataFim) {
            dias.push({
                dia: dataAtual.getDate(),
                mes: dataAtual.getMonth(),
                ano: dataAtual.getFullYear(),
            });
            dataAtual.setDate(dataAtual.getDate() + 1);
        }

        const conflito = await validarFerias(dias, funcionario.id);

        if (conflito) {
            const confirmacao = confirm(
                `${nomeFuncionario} já está de férias neste período. Deseja continuar mesmo assim?`
            );
            if (!confirmacao) {
                return; // Cancela a operação se o usuário não confirmar
            }
        }

        await atualizarFeriasNoFirestore(funcionario.id, dias);

        funcionario.diasFerias = dias;

        preencherCalendario();

        exibirNotificacao("Férias cadastradas com sucesso para " + nomeFuncionario);
    }


    async function verificarConflitoFerias(nomeFuncionario, dataInicioDate, dataFimDate) {

        const feriasCadastradas = await buscarFeriasFuncionario(nomeFuncionario);

        for (let ferias of feriasCadastradas) {
            const feriasInicio = new Date(ferias.dataInicio);
            const feriasFim = new Date(ferias.dataFim);

            if ((dataInicioDate >= feriasInicio && dataInicioDate <= feriasFim) ||
                (dataFimDate >= feriasInicio && dataFimDate <= feriasFim) ||
                (dataInicioDate <= feriasInicio && dataFimDate >= feriasFim)) {
                return true;
            }
        }

        return false;
    }

    async function buscarFeriasFuncionario(nomeFuncionario) {
        return [
            { nomeFuncionario: 'João', dataInicio: '2024-12-01', dataFim: '2024-12-10' },
            { nomeFuncionario: 'João', dataInicio: '2024-12-20', dataFim: '2024-12-25' }
        ];
    }

    async function validarFerias(diasFerias, funcionarioId) {
        for (let funcionario of funcionarios) {
            if (funcionario.id !== funcionarioId && funcionario.diasFerias) {
                const conflito = funcionario.diasFerias.some(f =>
                    diasFerias.some(d => d.dia === f.dia && d.mes === f.mes && d.ano === f.ano)
                );
                if (conflito) {
                    return true;
                }
            }
        }
        return false;
    }



    async function atualizarFeriasNoFirestore(idFuncionario, diasFerias) {
        try {
            const funcionarioRef = doc(db, "funcionarios", idFuncionario);
            await updateDoc(funcionarioRef, {
                diasFerias: diasFerias
            });
        } catch (e) {
            console.error("Erro ao atualizar os dias de férias: ", e);
        }
    }


    async function salvarFuncionarioNoFirestore(nome, cargo, foto, cor) {
        try {
            const docRef = await addDoc(collection(db, "funcionarios"), {
                nome: nome,
                cargo: cargo,
                foto: foto,
                cor: cor,
                diasFerias: []
            });

            const funcionario = { nome, cargo, foto, cor, diasFerias: [], id: docRef.id };

            funcionarios.push(funcionario);

            renderizarFuncionarios();
            preencherSelectFuncionarios();

            console.log("Funcionário adicionado com ID: ", docRef.id);
        } catch (e) {
            console.error("Erro ao adicionar funcionário: ", e);
        }
    }

    async function redimensionarImagem(arquivo, larguraMaxima = 500) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(arquivo);

        await new Promise(resolve => img.onload = resolve);

        const canvas = document.createElement('canvas');
        const escala = larguraMaxima / img.width;

        canvas.width = larguraMaxima;
        canvas.height = img.height * escala;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/jpeg', 0.8);
    }

    document.getElementById('form-adicionar-funcionario').addEventListener('submit', async function (event) {
        event.preventDefault();

        const nome = document.getElementById('nome').value;
        const cargo = document.getElementById('setor').value;
        const fotoInput = document.getElementById('foto');
        const cor = document.getElementById('cor').value;

        let foto = '';
        if (fotoInput.files && fotoInput.files[0]) {
            foto = await redimensionarImagem(fotoInput.files[0]);
        }

        await salvarFuncionarioNoFirestore(nome, cargo, foto, cor);

        modal.classList.remove('show');
        formAdicionarFuncionario.reset();

        exibirNotificacao("Funcionário cadastrado com sucesso!");
    });

    async function carregarFuncionariosDoFirestore() {
        try {
            const querySnapshot = await getDocs(collection(db, "funcionarios"));
            funcionarios = [];

            querySnapshot.forEach((doc) => {
                const funcionario = doc.data();
                funcionario.id = doc.id;
                funcionarios.push(funcionario);
            });

            renderizarFuncionarios();
            preencherSelectFuncionarios();
        } catch (e) {
            console.error("Erro ao carregar funcionários: ", e);
        }
    }

    // Alterar a função de clique para o botão de remover férias
    document.querySelectorAll('.removerFerias').forEach(button => {
        button.addEventListener('click', async (event) => {
            const idFuncionario = event.target.getAttribute('data-id');
            await removerFeriasFuncionario(idFuncionario);  // Remover as férias
        });
    });


    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    btnAdicionarFuncionario.addEventListener("click", () => {
        modalFuncionario.classList.add("show");
        modalFerias.classList.remove("show");
    });

    btnAdicionarFerias.addEventListener("click", () => {
        modalFerias.classList.add("show");
        modalFuncionario.classList.remove("show");
    });

    closeModalFuncionario.addEventListener("click", () => {
        modalFuncionario.classList.remove("show");
    });

    closeModalFerias.addEventListener("click", () => {
        modalFerias.classList.remove("show");
    });

    window.addEventListener('click', (event) => {
        if (event.target === modalFuncionario) {
            modalFuncionario.classList.remove('show');
        } else if (event.target === modalFerias) {
            modalFerias.classList.remove('show');
        }
    });

    function preencherCalendario() {
        const data = new Date(anoAtual, mesAtual, 1);
        const primeiroDia = data.getDay();
        const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();
    
        let diasHtml = '';
        let dia = 1;
    
        diasHtml += '<tr>';
        for (let i = 0; i < primeiroDia; i++) {
            diasHtml += '<td class="empty"></td>';
        }
    
        for (let i = primeiroDia; i < 7; i++) {
            if (dia > ultimoDia) break;
            diasHtml += `<td data-dia="${dia}" data-mes="${mesAtual}" data-ano="${anoAtual}">${dia}</td>`;
            dia++;
        }
        diasHtml += '</tr>';
    
        while (dia <= ultimoDia) {
            diasHtml += '<tr>';
            for (let i = 0; i < 7; i++) {
                if (dia > ultimoDia) {
                    diasHtml += '<td class="empty"></td>';
                } else {
                    diasHtml += `<td data-dia="${dia}" data-mes="${mesAtual}" data-ano="${anoAtual}">${dia}</td>`;
                    dia++;
                }
            }
            diasHtml += '</tr>';
        }
    
        diasCalendario.innerHTML = diasHtml;
    
        // Atualiza o título do mês com o nome correto
        mesAno.textContent = `${meses[mesAtual]} ${anoAtual}`;
    
        colorirDiasFerias();
    }
    



    function colorirDiasFerias() {
        // Limpa estilos anteriores
        document.querySelectorAll("td[data-dia]").forEach(td => {
            td.style.backgroundColor = '';
            td.style.color = '';
            td.style.backgroundImage = '';
            td.title = `Férias de ${ferias[0].nome}`;

        });

        const feriasPorDia = {};

        // Mapeia os dias ocupados por férias de funcionários
        funcionarios.forEach(funcionario => {
            if (funcionario.diasFerias) {
                funcionario.diasFerias.forEach(diaFerias => {
                    const chaveDia = `${diaFerias.dia}-${diaFerias.mes}-${diaFerias.ano}`;
                    if (!feriasPorDia[chaveDia]) {
                        feriasPorDia[chaveDia] = [];
                    }
                    feriasPorDia[chaveDia].push({
                        nome: funcionario.nome,
                        cor: funcionario.cor,
                    });
                });
            }
        });

        // Atualiza o estilo do calendário
for (const chaveDia in feriasPorDia) {
    const [dia, mes, ano] = chaveDia.split('-');
    const diaElement = document.querySelector(
        `td[data-dia="${dia}"][data-mes="${mes}"][data-ano="${ano}"]`
    );

    if (diaElement) {
        const ferias = feriasPorDia[chaveDia];

        if (ferias.length === 1) {
            // Um único funcionário no dia
            diaElement.style.backgroundColor = ferias[0].cor;
            diaElement.style.color = 'white';
            // Remover a atribuição de title
            // diaElement.title = `Férias de ${ferias[0].nome}`;
        } else if (ferias.length === 2) {
            // Dois funcionários no mesmo dia
            diaElement.style.backgroundImage = `linear-gradient(to right, ${ferias[0].cor}, ${ferias[1].cor})`;
            diaElement.style.color = 'white';
            // Remover a atribuição de title
            // diaElement.title = `Férias de ${ferias.map(f => f.nome).join(' e ')}`;
        } else {
            // Caso de mais de dois funcionários (se necessário)
        }
    }
}

    }


    function adicionarFuncionario(nome, cargo, foto, cor) {
        const funcionario = { nome, cargo, foto, cor, diasFerias: [] };

        renderizarFuncionarios();
        preencherCalendario();
        preencherSelectFuncionarios();
    }

    function renderizarFuncionarios() {
        funcionariosContainer.innerHTML = '';
        funcionarios.forEach(funcionario => {
            const divFuncionario = document.createElement('div');
            divFuncionario.classList.add('funcionario');
            divFuncionario.innerHTML = `
                <img src="${funcionario.foto}" alt="Foto de ${funcionario.nome}">
                <div class="infos">
                    <h4>${funcionario.nome}</h4>
                    <p>${funcionario.cargo}</p>
                </div>
                <div class="menu-container">
                    <span id='removerFuncionario' class="material-symbols-outlined removerFuncionario" data-id="${funcionario.id}">person_remove</span>
                    <span id='removerFerias' class="removerFerias material-symbols-outlined" data-id="${funcionario.id}">free_cancellation</span>
                </div>
            `;
            divFuncionario.style.borderLeft = `5px solid ${funcionario.cor || 'black'}`;
            funcionariosContainer.appendChild(divFuncionario);
        });

        // Exemplo de uso: botão para excluir funcionário
        document.querySelectorAll('.removerFuncionario').forEach(button => {
            button.addEventListener('click', async (event) => {
                const idFuncionario = event.target.getAttribute('data-id');
                await excluirFuncionario(idFuncionario); // Confirma e exclui o funcionário
            });
        });
    }


    // Função para excluir férias de um funcionário com confirmação
    async function removerFeriasFuncionario(idFuncionario) {
        const confirmar = confirm("Tem certeza de que deseja remover as férias deste funcionário?");
        if (confirmar) {
            try {
                const funcionarioRef = doc(db, "funcionarios", idFuncionario);
                await updateDoc(funcionarioRef, {
                    diasFerias: [] // Remove todas as férias
                });

                // Atualiza localmente
                const funcionario = funcionarios.find(f => f.id === idFuncionario);
                if (funcionario) {
                    funcionario.diasFerias = [];
                }

                preencherCalendario();
                exibirNotificacao("Férias removidas com sucesso!");
            } catch (e) {
                console.error("Erro ao remover férias: ", e);
            }
        }
    }

    // Função para excluir funcionário com confirmação
    async function excluirFuncionario(idFuncionario) {
        const confirmar = confirm("Tem certeza de que deseja excluir este funcionário?");
        if (confirmar) {
            try {
                const funcionarioRef = doc(db, "funcionarios", idFuncionario);
                await deleteDoc(funcionarioRef);

                // Remove o funcionário localmente para atualizar a interface
                funcionarios = funcionarios.filter(funcionario => funcionario.id !== idFuncionario);

                renderizarFuncionarios();
                exibirNotificacao("Funcionário excluído com sucesso!");
            } catch (e) {
                console.error("Erro ao excluir funcionário: ", e);
            }
        }
    }


    document.querySelector('.close-icon').addEventListener('click', () => {
        document.querySelector('.notficacao').style.display = 'none';
    });

    formAdicionarFuncionario.addEventListener('submit', function (event) {
        event.preventDefault();

        const nome = document.getElementById('nome').value;
        const cargo = document.getElementById('setor').value;
        const fotoInput = document.getElementById('foto');
        const cor = document.getElementById('cor').value;

        let foto = '';
        if (fotoInput.files && fotoInput.files[0]) {
            foto = URL.createObjectURL(fotoInput.files[0]);
        }

        adicionarFuncionario(nome, cargo, foto, cor);

        modal.classList.remove('show');

        formAdicionarFuncionario.reset();
    });

    function atualizarMesAno() {
        mesAno.textContent = `${meses[mesAtual]} ${anoAtual}`;

    }

    botaoAvancar.addEventListener('click', () => {
        mesAtual++;
        if (mesAtual > 11) {
            mesAtual = 0;
            anoAtual++;
        }
        atualizarMesAno();
        preencherCalendario();
    });

    botaovoltar.addEventListener('click', () => {
        mesAtual--;
        if (mesAtual < 0) {
            mesAtual = 11;
            anoAtual--;
        }
        atualizarMesAno();
        preencherCalendario();
    });


    botaoHoje.addEventListener("click", () => {
        // Atualiza as variáveis para o mês e ano atuais
        mesAtual = hoje.getMonth();
        anoAtual = hoje.getFullYear();

        // Atualiza o título do calendário com o mês e ano atuais
        mesAno.textContent = `${meses[mesAtual]} de ${anoAtual}`;

        // Repreenche o calendário para refletir o mês atual
        preencherCalendario();
    });


    function preencherSelectFuncionarios() {
        const selectFuncionario = document.getElementById('funcionario');
        selectFuncionario.innerHTML = '';

        funcionarios.forEach(funcionario => {
            const option = document.createElement('option');
            option.value = funcionario.nome;
            option.textContent = funcionario.nome;
            selectFuncionario.appendChild(option);
        });
    }


    function exibirNotificacao(mensagem) {
        const notificacao = document.getElementById('notificacao');
        const textoNotificacao = document.querySelector('.infosnotificacao p');

        textoNotificacao.textContent = mensagem;

        notificacao.classList.add('mostrar');

        setTimeout(() => {
            notificacao.classList.remove('mostrar');
        }, 2000);
    }


    document.getElementById('fecharNotificacao').addEventListener('click', () => {
        const notificacao = document.getElementById('notificacao');
        notificacao.classList.remove('mostrar');
    });

    btnAdicionarFerias.addEventListener("click", () => {
        modalFerias.classList.add("show");
        modalFuncionario.classList.remove("show");
        preencherSelectFuncionarios();
    });



    document.getElementById('form-adicionar-ferias').addEventListener('submit', async function (event) {
        event.preventDefault();

        const nomeFuncionario = document.getElementById('funcionario').value;
        const dataInicio = document.getElementById('dataInicio').value.split("-");
        const dataInicioDate = new Date(dataInicio[0], dataInicio[1] - 1, dataInicio[2]);
        const dataFim = document.getElementById('dataFim').value.split("-");
        const dataFimDate = new Date(dataFim[0], dataFim[1] - 1, dataFim[2]);

        const existeConflito = await verificarConflitoFerias(nomeFuncionario, dataInicioDate, dataFimDate);

        if (existeConflito) {
            alert("Já existem férias cadastradas para esse período.");
            return;
        }

        await calcularDiasFerias(dataInicioDate, dataFimDate, nomeFuncionario);

        modalFerias.classList.remove('show');

        preencherCalendario();
    });


    preencherCalendario();
});
