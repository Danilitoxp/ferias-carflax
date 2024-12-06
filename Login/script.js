import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAf1i_2cxfJ8gCemPL0tUeLEZGk2s2nciw",
    authDomain: "carflax-ferias.firebaseapp.com",
    projectId: "carflax-ferias",
    storageBucket: "carflax-ferias.firebasestorage.app",
    messagingSenderId: "200010032965",
    appId: "1:200010032965:web:f5dda20c6f1636ed07c02c"
};

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Selecionar elementos da DOM
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-btn');

// Mostrar loader e redirecionar
function showLoaderAndRedirect(url) {
    const loader = document.querySelector('.loader');
    const container = document.querySelector('.container');

    // Mostrar o loader e ocultar o container
    loader.style.display = 'block';
    container.style.display = 'none';

    // Redirecionar após um pequeno atraso
    setTimeout(() => {
        window.location.href = url;
    }, 1000); // 1 segundo
}

// Função de login
function login() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Verificar se os campos estão preenchidos
    if (!email || !password) {
        alert("Por favor, preencha todos os campos!");
        return;
    }

    // Autenticação com email e senha
    signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            const user = userCredential.user;
            
            // Verificar e-mail e redirecionar conforme necessário
            if (user.email === 'joao@carflax.com.br') {
                // Redireciona para a plataforma se o e-mail for joao@carflax.com.br
                showLoaderAndRedirect('/Plataforma/index.html');
            } else {
                // Redireciona para a página de funcionário para outros usuários
                showLoaderAndRedirect('/Funcionario/index.html');
            }
        })
        .catch(error => {
            // Tratar erros de login
            switch (error.code) {
                case 'auth/user-not-found':
                    alert('Usuário não encontrado.');
                    break;
                case 'auth/wrong-password':
                    alert('Senha incorreta.');
                    break;
                default:
                    alert('Erro ao realizar login. Tente novamente.');
                    console.error(error);
            }
        });
}

// Adicionar evento ao botão de login
loginButton.addEventListener('click', login);

// Permitir login com Enter
document.addEventListener('keypress', event => {
    if (event.key === 'Enter') {
        login();
    }
});
