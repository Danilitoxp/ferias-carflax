import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAf1i_2cxfJ8gCemPL0tUeLEZGk2s2nciw",
  authDomain: "carflax-ferias.firebaseapp.com",
  projectId: "carflax-ferias",
  storageBucket: "carflax-ferias.firebasestorage.app",
  messagingSenderId: "200010032965",
  appId: "1:200010032965:web:f5dda20c6f1636ed07c02c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let funcionariosCacheados = false;
let funcionarios = [];

document.addEventListener("DOMContentLoaded", async function () {
  const diasCalendario = document.getElementById("diasCalendario");
  const mesAno = document.getElementById("mesAno");
  const botaovoltar = document.querySelector("#voltar");
  const modal = document.querySelector(".modal");
  const btnAdicionarFuncionario = document.getElementById(
    "adicionarFuncionarioBtn"
  );
  const formAdicionarFuncionario = document.getElementById(
    "form-adicionar-funcionario"
  );
  const funcionariosContainer = document.querySelector(".funcionarios");
  const botaoAvancar = document.getElementById("avancar");
  const botaoHoje = document.getElementById("hoje");
  const btnAdicionarFerias = document.getElementById("adicionarFeriasBtn");

  await carregarFuncionariosDoFirestore();

  const modalFuncionario = document.querySelector(".modal");
  const modalFerias = document.getElementById("modalAdicionarFerias");

  const closeModalFuncionario = document.querySelector(".close-modal");
  const closeModalFerias = document.querySelector(".close-modal-ferias");

  

  let hoje = new Date();
  let mesAtual = hoje.getMonth(); // Obtém o mês atual (0 = Janeiro, 11 = Dezembro)
  let anoAtual = hoje.getFullYear(); // Obtém o ano atual

  async function calcularDiasFerias(dataInicio, dataFim, nomeFuncionario) {
    const funcionario = funcionarios.find((f) => f.nome === nomeFuncionario);
    if (!funcionario) {
      console.error("Funcionário não encontrado!");
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
  
    await atualizarFeriasNoFirestore(funcionario.id, dias, funcionario.cargo); // Passa o setor
    funcionario.diasFerias = dias;
  
    preencherCalendario();
  
    exibirNotificacao("Férias cadastradas com sucesso para " + nomeFuncionario);
  }

  async function verificarConflitoFerias(nomeFuncionario, dataInicioDate, dataFimDate) {
    const feriasFuncionarios = await buscarFeriasFuncionarios(); // Buscar no Firestore
  
    for (let ferias of feriasFuncionarios) {
      if (ferias.nomeFuncionario !== nomeFuncionario) {
        const inicioFerias = new Date(ferias.dataInicio);
        const fimFerias = new Date(ferias.dataFim);
  
        if (
          (dataInicioDate <= fimFerias && dataInicioDate >= inicioFerias) ||
          (dataFimDate <= fimFerias && dataFimDate >= inicioFerias) ||
          (dataInicioDate <= inicioFerias && dataFimDate >= fimFerias)
        ) {
          return true;
        }
      }
    }
    return false;
  }
  

  // Função fictícia para buscar todas as férias cadastradas
  async function buscarFeriasFuncionarios() {
    // Essa função deve retornar um array com as férias de todos os funcionários
    // Exemplo de dados retornados:
    return [
      {
        nomeFuncionario: "João",
        dataInicio: "2024-12-01",
        dataFim: "2024-12-15",
      },
      {
        nomeFuncionario: "Maria",
        dataInicio: "2024-12-10",
        dataFim: "2024-12-20",
      },
    ];
  }

  async function validarFerias(diasFerias, funcionarioId) {
    let conflito = false;

    for (let funcionario of funcionarios) {
      if (funcionario.id !== funcionarioId && funcionario.diasFerias) {
        // Verifica se há algum conflito de datas com outros funcionários
        const conflitoFuncionario = funcionario.diasFerias.some((f) =>
          diasFerias.some(
            (d) => d.dia === f.dia && d.mes === f.mes && d.ano === f.ano
          )
        );
        if (conflitoFuncionario) {
          conflito = true; // Há conflito de datas
          break;
        }
      }
    }
    return true; // Permite adicionar as férias
  }

  async function atualizarFeriasNoFirestore(idFuncionario, diasFerias, setor) {
    try {
      const funcionarioRef = doc(db, "funcionarios", idFuncionario);
      const diasFormatted = diasFerias.map(dia => ({
        ...dia,
        data: new Date(dia.ano, dia.mes, dia.dia).toISOString() // Converte para ISO
      }));
      await updateDoc(funcionarioRef, {
        diasFerias: diasFormatted,
        setor: setor // Atualiza o setor se necessário
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
        diasFerias: [],
        setor: cargo // Salva o setor
      });
  
      const funcionario = {
        nome,
        cargo,
        foto,
        cor,
        diasFerias: [],
        id: docRef.id,
      };
  
      funcionarios.push(funcionario);
      renderizarFuncionarios();
      preencherSelectFuncionarios();
  
      console.log("Funcionário adicionado com ID: ", docRef.id);
    } catch (e) {
      console.error("Erro ao adicionar funcionário: ", e);
    }
  }

  async function redimensionarImagem(arquivo, larguraMaxima = 500) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(arquivo);

    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement("canvas");
    const escala = larguraMaxima / img.width;

    canvas.width = larguraMaxima;
    canvas.height = img.height * escala;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.8);
  }

  document
    .getElementById("form-adicionar-funcionario")
    .addEventListener("submit", async function (event) {
      event.preventDefault();

      const nome = document.getElementById("nome").value;
      const cargo = document.getElementById("setor").value;
      const fotoInput = document.getElementById("foto");
      const cor = document.getElementById("cor").value;

      let foto = "";
      if (fotoInput.files && fotoInput.files[0]) {
        foto = await redimensionarImagem(fotoInput.files[0]);
      }

      await salvarFuncionarioNoFirestore(nome, cargo, foto, cor);

      modal.classList.remove("show");
      formAdicionarFuncionario.reset();

      exibirNotificacao("Funcionário cadastrado com sucesso!");
    });

    async function carregarFuncionariosDoFirestore() {
      if (funcionariosCacheados) return; // Evita carregamento repetido
    
      try {
        const querySnapshot = await getDocs(collection(db, "funcionarios"));
        funcionarios = [];
        querySnapshot.forEach((doc) => {
          // Adiciona os dados do funcionário ao array
          funcionarios.push({
            id: doc.id,
            ...doc.data() // Inclui todos os dados do documento
          });
        });
        funcionariosCacheados = true;
        renderizarFuncionarios(); // Chama a função para renderizar os funcionários
      } catch (e) {
        console.error("Erro ao carregar funcionários:", e);
      }
    }


 async function removerFeriasFuncionario(idFuncionario) {
  try {
    // Encontrar o funcionário no array
    const funcionario = funcionarios.find((f) => f.id === idFuncionario);

    if (!funcionario) {
      console.error("Funcionário não encontrado!");
      return;
    }

    // Remover as férias do funcionário
    funcionario.diasFerias = [];

    // Atualizar no Firestore
    const funcionarioRef = doc(db, "funcionarios", idFuncionario);
    await updateDoc(funcionarioRef, {
      diasFerias: [] // Remover as férias do funcionário
    });

    // Atualizar o frontend
    renderizarFuncionarios(); // Re-renderiza a lista de funcionários para refletir a remoção das férias

    // Notificar sucesso
    exibirNotificacao("Férias removidas com sucesso para " + funcionario.nome);
  } catch (e) {
    console.error("Erro ao remover férias do funcionário: ", e);
  }
}

  

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
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

  window.addEventListener("click", (event) => {
    if (event.target === modalFuncionario) {
      modalFuncionario.classList.remove("show");
    } else if (event.target === modalFerias) {
      modalFerias.classList.remove("show");
    }
  });

  function preencherCalendario() {
    const data = new Date(anoAtual, mesAtual, 1);
    const primeiroDia = data.getDay();
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();

    let diasHtml = "";
    let dia = 1;

    diasHtml += "<tr>";
    for (let i = 0; i < primeiroDia; i++) {
      diasHtml += '<td class="empty"></td>';
    }

    for (let i = primeiroDia; i < 7; i++) {
      if (dia > ultimoDia) break;
      diasHtml += `<td data-dia="${dia}" data-mes="${mesAtual}" data-ano="${anoAtual}">${dia}</td>`;
      dia++;
    }
    diasHtml += "</tr>";

    while (dia <= ultimoDia) {
      diasHtml += "<tr>";
      for (let i = 0; i < 7; i++) {
        if (dia > ultimoDia) {
          diasHtml += '<td class="empty"></td>';
        } else {
          diasHtml += `<td data-dia="${dia}" data-mes="${mesAtual}" data-ano="${anoAtual}">${dia}</td>`;
          dia++;
        }
      }
      diasHtml += "</tr>";
    }

    diasCalendario.innerHTML = diasHtml;
    atualizarMesAno();
    colorirDiasFerias();
  }

  function colorirDiasFerias() {
    // Limpa estilos anteriores
    document.querySelectorAll("td[data-dia]").forEach((td) => {
      td.style.backgroundColor = "";
      td.style.color = "";
      td.style.backgroundImage = "";
      td.title = "";
    });
  
    const feriasPorDia = {};
    const setorSelecionado = document.getElementById("setor").value; // Obtém o setor selecionado
  
    // Mapeia os dias ocupados por férias de funcionários do setor selecionado
    funcionarios.forEach((funcionario) => {
      if (funcionario.diasFerias && funcionario.cargo === setorSelecionado) {
        funcionario.diasFerias.forEach((diaFerias) => {
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
      const [dia, mes, ano] = chaveDia.split("-");
      const diaElement = document.querySelector(
        `td[data-dia="${dia}"][data-mes="${mes}"][data-ano="${ano}"]`
      );
  
      if (diaElement) {
        const ferias = feriasPorDia[chaveDia];
  
        // Se há mais de 1 funcionário no mesmo dia, aplicar um gradiente
        if (ferias.length > 1) {
          const cores = ferias.map((f) => f.cor);
          const gradiente = `linear-gradient(to right, ${cores.join(", ")})`;
  
          diaElement.style.backgroundImage = gradiente;
          diaElement.style.color = "white"; // Pode ser ajustado para visibilidade
          diaElement.title = `Férias de ${ferias.map((f) => f.nome).join(", ")}`;
        } else {
          // Apenas um funcionário no dia
          diaElement.style.backgroundColor = ferias[0].cor;
          diaElement.style.color = "white";
          diaElement.title = `Férias de ${ferias[0].nome}`;
        }
      }
    }
  }

  document.getElementById("setor").addEventListener("change", function() {
    const setorSelecionado = this.value;
    filtrarFuncionariosPorSetor(setorSelecionado);
  });
  
  async function filtrarFuncionariosPorSetor(setor) {
    const funcionariosFiltrados = funcionarios.filter((funcionario) => funcionario.cargo === setor);
    renderizarFuncionarios(funcionariosFiltrados);
    
    // Atualiza o calendário para mostrar apenas as férias do setor selecionado
    preencherCalendario();
  }

  function adicionarFuncionario(nome, cargo, foto, cor) {
    const funcionario = { nome, cargo, foto, cor, diasFerias: [] };

    renderizarFuncionarios();
    preencherCalendario();
    preencherSelectFuncionarios();
  }

  function renderizarFuncionarios(lista = funcionarios) {
    const funcionariosContainer = document.querySelector(".funcionarios");
    funcionariosContainer.innerHTML = ""; // Limpa o container antes de adicionar os novos elementos

    lista.forEach((funcionario) => {
        // Criando o elemento de funcionário
        const funcionarioElement = document.createElement("div");
        funcionarioElement.classList.add("funcionario");

        // Adicionando a borda colorida
        funcionarioElement.style.borderLeft = `5px solid ${funcionario.cor || "black"}`;

        // Criando o conteúdo interno do funcionário (imagem, nome, cargo)
        const imgElement = document.createElement("img");
        imgElement.src = funcionario.foto;
        imgElement.alt = `Foto de ${funcionario.nome}`;

        const infosDiv = document.createElement("div");
        infosDiv.classList.add("infos");

        const nomeElement = document.createElement("h4");
        nomeElement.textContent = funcionario.nome;

        const cargoElement = document.createElement("p");
        cargoElement.textContent = funcionario.cargo;

        infosDiv.appendChild(nomeElement);
        infosDiv.appendChild(cargoElement);

        // Criando o menu de ações
        const menuContainer = document.createElement("div");
        menuContainer.classList.add("menu-container");

        // Botão para remover funcionário
        const removerFuncionarioSpan = document.createElement("span");
        removerFuncionarioSpan.classList.add("material-symbols-outlined", "removerFuncionario");
        removerFuncionarioSpan.setAttribute("data-id", funcionario.id);
        removerFuncionarioSpan.textContent = "person_remove";
        removerFuncionarioSpan.addEventListener("click", () => {
            // Lógica para remover funcionário
            removerFuncionario(funcionario.id);
        });

        // Botão para remover férias
        const removerFeriasSpan = document.createElement("span");
        removerFeriasSpan.classList.add("removerFerias", "material-symbols-outlined");
        removerFeriasSpan.setAttribute("data-id", funcionario.id);
        removerFeriasSpan.textContent = "free_cancellation";
        removerFeriasSpan.addEventListener("click", () => {
            // Lógica para remover férias do funcionário
            removerFeriasFuncionario(funcionario.id);
        });

        menuContainer.appendChild(removerFuncionarioSpan);
        menuContainer.appendChild(removerFeriasSpan);

        // Adicionando os elementos ao funcionário
        funcionarioElement.appendChild(imgElement);
        funcionarioElement.appendChild(infosDiv);
        funcionarioElement.appendChild(menuContainer);

        // Adicionando o elemento do funcionário ao container
        funcionariosContainer.appendChild(funcionarioElement);
    });
    

    document.getElementById("searchFuncionario").addEventListener("input", (event) => {
      const termoBusca = event.target.value.toLowerCase();
      const funcionariosFiltrados = funcionarios.filter((funcionario) =>
        funcionario.nome.toLowerCase().includes(termoBusca)
      );
      renderizarFuncionarios(funcionariosFiltrados);
    });
    
    

    // Exemplo de uso: botão para excluir funcionário
    document.querySelectorAll(".removerFuncionario").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const idFuncionario = event.target.getAttribute("data-id");
        await excluirFuncionario(idFuncionario); // Confirma e exclui o funcionário
      });
    });
  }



  async function removerFeriasFuncionario(idFuncionario) {
    // Solicita confirmação do usuário antes de remover as férias
    const confirmarRemocao = window.confirm("Tem certeza de que deseja remover as férias deste funcionário?");
    
    if (!confirmarRemocao) {
      return; // Se o usuário não confirmar, a função é interrompida
    }
  
    try {
      const funcionarioRef = doc(db, "funcionarios", idFuncionario);
      
      // Remove as férias do funcionário (define diasFerias como um array vazio)
      await updateDoc(funcionarioRef, {
        diasFerias: []
      });
      
      // Atualiza a lista de funcionários localmente
      const funcionario = funcionarios.find(f => f.id === idFuncionario);
      if (funcionario) {
        funcionario.diasFerias = [];
      }
  
      // Atualiza o calendário
      preencherCalendario();
      exibirNotificacao("Férias removidas com sucesso!");
    } catch (e) {
      console.error("Erro ao remover férias: ", e);
      exibirNotificacao("Erro ao remover férias!");
    }
  }
  

  // Função para excluir funcionário com confirmação
  async function excluirFuncionario(idFuncionario) {
    const confirmar = confirm(
      "Tem certeza de que deseja excluir este funcionário?"
    );
    if (confirmar) {
      try {
        const funcionarioRef = doc(db, "funcionarios", idFuncionario);
        await deleteDoc(funcionarioRef);

        // Remove o funcionário localmente para atualizar a interface
        funcionarios = funcionarios.filter(
          (funcionario) => funcionario.id !== idFuncionario
        );

        renderizarFuncionarios();
        exibirNotificacao("Funcionário excluído com sucesso!");
      } catch (e) {
        console.error("Erro ao excluir funcionário: ", e);
      }
    }
  }

  document.querySelector(".close-icon").addEventListener("click", () => {
    document.querySelector(".notficacao").style.display = "none";
  });

  formAdicionarFuncionario.addEventListener("submit", function (event) {
    event.preventDefault();

    const nome = document.getElementById("nome").value;
    const cargo = document.getElementById("setor").value;
    const fotoInput = document.getElementById("foto");
    const cor = document.getElementById("cor").value;

    let foto = "";
    if (fotoInput.files && fotoInput.files[0]) {
      foto = URL.createObjectURL(fotoInput.files[0]);
    }

    adicionarFuncionario(nome, cargo, foto, cor);

    modal.classList.remove("show");

    formAdicionarFuncionario.reset();
  });

  function atualizarMesAno() {
    const mesAtualTexto = meses[mesAtual];
    mesAno.textContent = `${mesAtualTexto} / ${anoAtual}`;
  }

  botaoAvancar.addEventListener("click", () => {
    mesAtual++;
    if (mesAtual > 11) {
      mesAtual = 0;
      anoAtual++;
    }
    atualizarMesAno();
    preencherCalendario();
  });

  botaovoltar.addEventListener("click", () => {
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
    const selectFuncionario = document.getElementById("funcionario");
    selectFuncionario.innerHTML = "";

    funcionarios.forEach((funcionario) => {
      const option = document.createElement("option");
      option.value = funcionario.nome;
      option.textContent = funcionario.nome;
      selectFuncionario.appendChild(option);
    });
  }

  function exibirNotificacao(mensagem) {
    const notificacao = document.getElementById("notificacao");
    const textoNotificacao = document.querySelector(".infosnotificacao p");

    textoNotificacao.textContent = mensagem;

    notificacao.classList.add("mostrar");

    setTimeout(() => {
      notificacao.classList.remove("mostrar");
    }, 2000);
  }

  document.getElementById("fecharNotificacao").addEventListener("click", () => {
    const notificacao = document.getElementById("notificacao");
    notificacao.classList.remove("mostrar");
  });

  btnAdicionarFerias.addEventListener("click", () => {
    modalFerias.classList.add("show");
    modalFuncionario.classList.remove("show");
    preencherSelectFuncionarios();
  });

  document
    .getElementById("form-adicionar-ferias")
    .addEventListener("submit", async function (event) {
      event.preventDefault();

      const nomeFuncionario = document.getElementById("funcionario").value;
      const dataInicio = document.getElementById("dataInicio").value.split("-");
      const dataInicioDate = new Date(
        dataInicio[0],
        dataInicio[1] - 1,
        dataInicio[2]
      );
      const dataFim = document.getElementById("dataFim").value.split("-");
      const dataFimDate = new Date(dataFim[0], dataFim[1] - 1, dataFim[2]);

      // Verificar conflitos de férias
      const conflito = await verificarConflitoFerias(
        nomeFuncionario,
        dataInicioDate,
        dataFimDate
      );

      if (conflito) {
        const confirmacao = confirm(
          `Já existem férias cadastradas neste período. Deseja continuar mesmo assim?`
        );
        if (!confirmacao) return; // Cancela a operação se o usuário não confirmar
      }

      await calcularDiasFerias(dataInicioDate, dataFimDate, nomeFuncionario);

      // Fechar o modal de férias
      document.getElementById("modalAdicionarFerias").classList.remove("show");

      // Atualizar o calendário
      preencherCalendario();
    });

  preencherCalendario();
});
