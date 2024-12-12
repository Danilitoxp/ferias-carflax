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
  const botaoAvancar = document.getElementById("avancar");
  const botaoHoje = document.getElementById("hoje");
  const btnAdicionarFerias = document.getElementById("adicionarFeriasBtn");

  await verificarNotificacoes(); // Chama a função para verificar notificações ao clicar no botão
  await carregarFuncionariosDoFirestore();

  const modalFuncionario = document.querySelector(".modal");
  const modalFerias = document.getElementById("modalAdicionarFerias");

  const closeModalFuncionario = document.querySelector(".close-modal");
  const closeModalFerias = document.querySelector(".close-modal-ferias");

  const setorSelecionado = "Vendas";
  document.getElementById("setor").value = setorSelecionado;

  // Carregar os funcionários e filtrar por setor
  await carregarFuncionariosDoFirestore();
  filtrarFuncionariosPorSetor(setorSelecionado); // Filtra os funcionários para mostrar apenas os de vendas
  preencherSelectFuncionarios(setorSelecionado);

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

    // Atualiza o estado do botão de notificação
    await verificarNotificacoes(); // Atualiza o botão de notificação
  }

  async function verificarConflitoFerias(
    nomeFuncionario,
    dataInicioDate,
    dataFimDate
  ) {
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

  async function buscarFeriasFuncionarios() {
    const feriasRef = collection(db, "ferias");
    const querySnapshot = await getDocs(feriasRef);
    const ferias = querySnapshot.docs.map((doc) => doc.data());
    return ferias;
  }

  async function atualizarFeriasNoFirestore(idFuncionario, diasFerias, setor) {
    try {
      const funcionarioRef = doc(db, "funcionarios", idFuncionario);
      const diasFormatted = diasFerias.map((dia) => ({
        ...dia,
        data: new Date(dia.ano, dia.mes, dia.dia).toISOString(), // Converte para ISO
      }));

      if (diasFormatted.length > 0) {
        await updateDoc(funcionarioRef, {
          diasFerias: diasFormatted,
          setor: setor, // Atualiza o setor se necessário
        });
      } else {
        // Se não houver dias de férias restantes, remove as férias e a notificação
        await updateDoc(funcionarioRef, {
          diasFerias: [],
          setor: setor,
          visto: false, // Opcional, para garantir que a notificação seja removida
        });
      }

      // Atualiza as notificações na interface
      const notificacoes = await buscarFuncionariosProximosFerias();
      mostrarNotificacoes(notificacoes);
    } catch (e) {
      console.error("Erro ao atualizar os dias de férias: ", e);
    }
  }

  // notificacao
  // Selecionar o modal e o botão de fechar
  const modalAlerta = document.getElementById("modalAlerta");
  const closeButton = document.querySelector(".close-modal-alerta");

  // Função para abrir o modal
  function abrirModal() {
    modalAlerta.style.display = "flex";
  }

  // Função para fechar o modal
  function fecharModal() {
    modalAlerta.style.display = "none";
  }

  // Fechar o modal ao clicar no botão de fechar
  closeButton.addEventListener("click", fecharModal);

  // Fechar o modal ao clicar fora do conteúdo do modal
  window.addEventListener("click", (event) => {
    if (event.target === modalAlerta) {
      fecharModal();
    }
  });

  // Adicionar evento de clique no botão de notificação
  document.getElementById("alerta").addEventListener("click", async () => {
    abrirModal(); // Abre o modal após verificar as notificações
  });

  async function mostrarNotificacoes(notificacoes) {
  // Ordena as notificações por status de visto e data de férias
  notificacoes.sort((a, b) => {
    if (a.visto && !b.visto) return 1;
    if (!a.visto && b.visto) return -1;
    const dataFeriasA = new Date(a.diasFerias[0].data);
    const dataFeriasB = new Date(b.diasFerias[0].data);
    return dataFeriasB - dataFeriasA;
  });

  const notificacoesContainer = document.querySelector(".notificacoes");
  notificacoesContainer.innerHTML = ""; // Limpa notificações anteriores

  const botaoNotificacao = document.getElementById("alerta");

  for (const funcionario of notificacoes) {
    if (funcionario.diasFerias && funcionario.diasFerias.length > 0) {
      const divFuncionario = document.createElement("div");
      divFuncionario.classList.add("funcionario-alerta");

      // Verifica se o status de visto existe e define como falso se não existir
      if (funcionario.visto === undefined) {
        funcionario.visto = false;
      }

      // Obtém a data de início e a data de término das férias
      const dataInicio = new Date(funcionario.diasFerias[0].data);
      const dataFim = new Date(
        funcionario.diasFerias[funcionario.diasFerias.length - 1].data
      );

      // Formata as datas para o formato desejado
      const dataInicioFormatada = dataInicio.toLocaleDateString();
      const dataFimFormatada = dataFim.toLocaleDateString();

      divFuncionario.innerHTML = `
      <img src="${
        funcionario.foto || "https://via.placeholder.com/60"
      }" alt="Foto do funcionário" class="funcionario-img">
      <div class="infos">
        <span class="funcionario-nome">${funcionario.nome}</span>
        <p class="funcionario-detalhes">${
          funcionario.nome
        } sairá de férias em ${dataInicioFormatada} até ${dataFimFormatada}!</p>
      </div>
    `;

      // Define a classe "visto" conforme o status do funcionário
      if (funcionario.visto) {
        divFuncionario.classList.add("visto");
      } else {
        divFuncionario.classList.remove("visto");
      }

      // Adiciona evento de clique para alternar o status de visto
      divFuncionario.addEventListener("click", async () => {
        funcionario.visto = !funcionario.visto; // Alterna o status de visto

        // Adiciona ou remove a classe para aplicar o estilo
        if (funcionario.visto) {
          divFuncionario.classList.add("visto");
        } else {
          divFuncionario.classList.remove("visto");
        }

        // Atualiza o Firestore para marcar a notificação como vista ou não vista
        await updateDoc(doc(db, "funcionarios", funcionario.id), {
          visto: funcionario.visto,
        });

        // Atualiza o ícone de notificação com base no status atual
        atualizarIconeNotificacao(notificacoes);
      });

      notificacoesContainer.appendChild(divFuncionario);
    }
  }

  // Inicializa o botão de notificação conforme o status inicial
  atualizarIconeNotificacao(notificacoes);
}

  function atualizarIconeNotificacao(notificacoes) {
    const botaoNotificacao = document.getElementById("alerta");
    const algumNaoVisto = notificacoes.some((f) => !f.visto);

    if (algumNaoVisto) {
      botaoNotificacao.innerHTML =
        '<img src="/images/Notficacao.svg" alt="Notificação">'; // Ícone de notificação
    } else {
      botaoNotificacao.innerHTML =
        '<img src="/images/sem Notficacao.svg" alt="Sem Notificação">'; // Ícone de sem notificação
    }
  }

  async function verificarNotificacoes() {
    const notificacoes = await buscarFuncionariosProximosFerias();

    if (notificacoes.length > 0) {
      mostrarNotificacoes(notificacoes); // Chama a função para mostrar as notificações
    } else {
      const botaoNotificacao = document.getElementById("alerta");
      botaoNotificacao.innerHTML =
        '<img src="/images/sem Notficacao.svg" alt="sem Notificação">'; // Exibe o ícone de sem notificação
      console.log("Nenhum funcionário próximo de tirar férias.");
    }
  }

  async function buscarFuncionariosProximosFerias() {
    const hoje = new Date();
    const dataLimite = new Date(hoje);
    dataLimite.setDate(hoje.getDate() + 30); // 30 dias a partir de hoje

    const querySnapshot = await getDocs(collection(db, "funcionarios"));
    const funcionariosProximosFerias = [];

    querySnapshot.forEach((doc) => {
      const funcionario = {
        id: doc.id,
        ...doc.data(),
        visto: doc.data().visto || false, // Garante que o status visto seja inicializado corretamente
      };

      // Verifica se o funcionário tem férias programadas
      if (funcionario.diasFerias && funcionario.diasFerias.length > 0) {
        funcionario.diasFerias.forEach((ferias) => {
          const dataFerias = new Date(ferias.data);

          // Verifica se a data de férias é exatamente 30 dias a partir de hoje
          const diffTime = dataFerias - hoje;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Converte a diferença para dias

          if (diffDays === 30) {
            funcionariosProximosFerias.push(funcionario); // Adiciona o funcionário ao array
          }
        });
      }
    });

    return funcionariosProximosFerias;
  }

  async function salvarFuncionarioNoFirestore(nome, cargo, foto, cor) {
    try {
      const docRef = await addDoc(collection(db, "funcionarios"), {
        nome: nome,
        cargo: cargo,
        foto: foto,
        cor: cor,
        diasFerias: [],
        setor: cargo, // Salva o setor
        visto: false, // Inicializa como não visto
      });

      const funcionario = {
        nome,
        cargo,
        foto,
        cor,
        diasFerias: [],
        id: docRef.id,
        visto: false, // Inicializa como não visto
      };

      funcionarios.push(funcionario);
      console.log("Funcionário adicionado:", funcionario);
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
          ...doc.data(), // Inclui todos os dados do documento
        });
      });
      funcionariosCacheados = true;
      renderizarFuncionarios(); // Chama a função para renderizar os funcionários
    } catch (e) {
      console.error("Erro ao carregar funcionários:", e);
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
          diaElement.title = `Férias de ${ferias
            .map((f) => f.nome)
            .join(", ")}`;
        } else {
          // Apenas um funcionário no dia
          diaElement.style.backgroundColor = ferias[0].cor;
          diaElement.style.color = "white";
          diaElement.title = `Férias de ${ferias[0].nome}`;
        }
      }
    }
  }

  document.getElementById("setor").addEventListener("change", function () {
    const setorSelecionado = this.value;
    filtrarFuncionariosPorSetor(setorSelecionado);
    preencherSelectFuncionarios(setorSelecionado); // Atualiza o select de funcionários
    preencherCalendario(); // Atualiza o calendário
  });

  async function filtrarFuncionariosPorSetor(setor) {
    const funcionariosFiltrados = funcionarios.filter(
      (funcionario) => funcionario.cargo === setor
    );
    renderizarFuncionarios(funcionariosFiltrados);
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

    const fragment = document.createDocumentFragment(); // Cria um fragmento de documento

    lista.forEach((funcionario) => {
      // Criando o elemento de funcionário
      const funcionarioElement = document.createElement("div");
      funcionarioElement.classList.add("funcionario");

      // Adicionando a borda colorida
      funcionarioElement.style.borderLeft = `5px solid ${
        funcionario.cor || "black"
      }`;

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
      removerFuncionarioSpan.classList.add(
        "material-symbols-outlined",
        "removerFuncionario"
      );
      removerFuncionarioSpan.setAttribute("data-id", funcionario.id);
      removerFuncionarioSpan.textContent = "person_remove";
      removerFuncionarioSpan.addEventListener("click", () => {
        // Lógica para remover funcionário
        removerFuncionario(funcionario.id);
      });

      // Botão para remover férias
      const removerFeriasSpan = document.createElement("span");
      removerFeriasSpan.classList.add(
        "removerFerias",
        "material-symbols-outlined"
      );
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

      // Adicionando o elemento do funcionário ao fragmento
      fragment.appendChild(funcionarioElement);
    });

    // Adiciona o fragmento ao container de funcionários de uma vez
    funcionariosContainer.appendChild(fragment);

    let timeoutId;

    document
      .getElementById("searchFuncionario")
      .addEventListener("input", (event) => {
        clearTimeout(timeoutId); // Limpa o timeout anterior
        const termoBusca = event.target.value.toLowerCase();

        timeoutId = setTimeout(() => {
          const funcionariosFiltrados = funcionarios.filter((funcionario) =>
            funcionario.nome.toLowerCase().includes(termoBusca)
          );
          renderizarFuncionarios(funcionariosFiltrados);
        }, 300); // Aguarda 300ms após o último evento de input
      });
  }

  async function removerFeriasFuncionario(idFuncionario) {
    // Solicita confirmação do usuário antes de remover as férias
    const confirmarRemocao = window.confirm(
      "Tem certeza de que deseja remover as férias deste funcionário?"
    );
  
    if (!confirmarRemocao) {
      return; // Se o usuário não confirmar, a função é interrompida
    }
  
    try {
      const funcionarioRef = doc(db, "funcionarios", idFuncionario);
  
      // Remove as férias do funcionário (define diasFerias como um array vazio)
      await updateDoc(funcionarioRef, {
        diasFerias: [],
      });
  
      // Atualiza a lista de funcionários localmente
      const funcionario = funcionarios.find((f) => f.id === idFuncionario);
      if (funcionario) {
        funcionario.diasFerias = [];
      }
  
      // Atualiza o calendário
      preencherCalendario();
      colorirDiasFerias(); // Atualiza as cores dos dias de férias
      exibirNotificacao("Férias removidas com sucesso!");
    } catch (e) {
      console.error("Erro ao remover férias: ", e);
      exibirNotificacao("Erro ao remover férias!");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await carregarFuncionariosDoFirestore();
    verificarNotificacoes(); // Chama a função para verificar notificações ao carregar a página
  });

  // Função para excluir funcionário com confirmação
  async function removerFuncionario(idFuncionario) {
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

  function preencherSelectFuncionarios(setorSelecionado) {
    const selectFuncionario = document.getElementById("funcionario");
    selectFuncionario.innerHTML = ""; // Limpa as opções anteriores

    const funcionariosFiltrados = funcionarios.filter(
      (funcionario) => funcionario.cargo === setorSelecionado
    );

    funcionariosFiltrados.forEach((funcionario) => {
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
    const setorSelecionado = document.getElementById("setor").value; // Obtém o setor selecionado
    preencherSelectFuncionarios(setorSelecionado); // Atualiza o select de funcionários
    modalFerias.classList.add("show");
    modalFuncionario.classList.remove("show");
  });

  async function obterFuncionarios() {
    const funcionariosRef = collection(db, "funcionarios");
    const querySnapshot = await getDocs(funcionariosRef);
    const funcionarios = querySnapshot.docs.map((doc) => doc.data());
    return funcionarios;
  }

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

    try {
      await calcularDiasFerias(dataInicioDate, dataFimDate, nomeFuncionario);
      console.log("Férias adicionadas com sucesso!");
      // Atualizar a variável funcionarios
      funcionarios = await obterFuncionarios();
      // Atualizar o calendário
      preencherCalendario();
      colorirDiasFerias();
    } catch (error) {
      console.error("Erro ao adicionar férias:", error);
    }

    // Fechar o modal de férias
    document.getElementById("modalAdicionarFerias").classList.remove("show");

    // Atualizar o calendário
    preencherCalendario();
  });

  preencherCalendario();
});
