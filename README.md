<div align="center">
  <img src="assets/images/logo-box.png" alt="Logo BOX Training Jardim Silvina" width="190" />
  <h1>BOX Jardim Silvina</h1>
  <p><strong>Treinos, presença e evolução em um só lugar.</strong></p>
  <p>
    <a href="https://js171555.github.io/box_jardim_silvina/login.html"><strong>↗ Abrir o aplicativo</strong></a>
    &nbsp;·&nbsp;
    <a href="#capturas-de-tela">Ver capturas</a>
  </p>
  <p>
    <img alt="Status" src="https://img.shields.io/badge/status-em%20evolu%C3%A7%C3%A3o-9BEA00?style=for-the-badge&labelColor=171A16" />
    <img alt="Idioma" src="https://img.shields.io/badge/idioma-pt--BR-171A16?style=for-the-badge" />
    <img alt="PWA" src="https://img.shields.io/badge/PWA-instal%C3%A1vel-9BEA00?style=for-the-badge&logo=pwa&logoColor=111111&labelColor=171A16" />
    <img alt="Supabase" src="https://img.shields.io/badge/backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white&labelColor=171A16" />
  </p>
</div>

---

## 📌 Sobre o projeto

O **BOX Jardim Silvina** é um aplicativo web responsivo para apoiar a rotina de um box de treinamento funcional. Ele reúne em uma única plataforma a área do aluno e as ferramentas de gestão do treinador, com autenticação e dados conectados ao Supabase.

A interface permite acompanhar a programação de treinos, registrar presença e resultados e visualizar a evolução. O app também pode ser instalado em dispositivos compatíveis como **Progressive Web App (PWA)**.

> O conteúdo disponível depende da configuração do projeto Supabase, das permissões e das migrações aplicadas ao banco.

## 🖼️ Capturas de tela

As imagens abaixo foram capturadas da versão publicada e mostram os estados públicos de entrada e criação de conta. Nenhum dado de usuário é exibido.

| Entrar | Criar conta |
|:---:|:---:|
| ![Tela de login do BOX Jardim Silvina](docs/screenshots/login.jpg) | ![Tela de criação de conta do BOX Jardim Silvina](docs/screenshots/cadastro.jpg) |

## ✨ Funcionalidades

### 🧑‍🎓 Área do aluno

- Cadastro e acesso por e-mail e senha, autenticação Google e recuperação de senha.
- Perfil com nome e foto.
- Programação semanal e detalhes do treino, com movimentos, aquecimento, mobilidade, equipamentos, escalas e orientações.
- Início e conclusão de treinos, com lançamento de tempo, rounds, repetições ou carga.
- Check-in e histórico de presenças, treinos e sequência.
- Gamificação: XP, níveis, conquistas, rankings e **O Trono**.
- Consulta a eventos, inscrições e produtos em destaque na loja.

### 🛠️ Painel do treinador

- Gestão de alunos e perfis, com permissões por papel.
- Criação, edição e publicação de treinos, incluindo adaptações individuais.
- Acompanhamento e gestão de presenças.
- Gestão de eventos, participantes e itens da loja.
- Registro de ações administrativas para auditoria.

### 📲 Aplicativo instalável

O projeto inclui manifesto PWA, ícones em vários tamanhos e um service worker com cache do app shell. O cache pode melhorar a disponibilidade de arquivos da interface; **autenticação e dados do Supabase não ficam disponíveis offline**.

## 🧰 Tecnologias

| Camada | Tecnologias |
|---|---|
| Interface | HTML, CSS e JavaScript nativo com módulos ES |
| Backend | Supabase Auth, PostgreSQL, Row Level Security (RLS), RPC e Storage |
| Instalação | Web App Manifest, service worker e cache de recursos estáticos |
| Ícones | Font Awesome |
| Hospedagem pública | GitHub Pages |

## 🚀 Configuração

### Pré-requisitos

- Um projeto Supabase.
- Git.
- Um servidor HTTP local e hospedagem HTTPS para produção.

### 1. Clonar o repositório

```bash
git clone https://github.com/JS171555/box_jardim_silvina.git
cd box_jardim_silvina
```

### 2. Configurar o Supabase

No Supabase, configure os provedores de autenticação desejados e permita os endereços locais e de produção em **Authentication → URL Configuration**. Para autenticação Google, habilite e configure também o provedor Google.

Confira `js/config.js` e configure a URL do projeto e a chave publicável/anon do Supabase. **Nunca coloque a chave `service_role` no frontend nem a publique no Git.**

> Ao conectar outra instância do Supabase, substitua os valores do cliente pela configuração dessa instância.

### 3. Preparar o banco de dados

No SQL Editor do Supabase, aplique os arquivos de `supabase/migrations/` em ordem:

1. `001_foundation.sql`
2. `002_training.sql`
3. `003_gamification.sql`
4. `004_events_store.sql`

As migrações criam tabelas, políticas RLS e funções usadas pelo app. Revise o conteúdo e confira o estado do banco antes de reaplicar scripts.

### 4. Provisionar o treinador

Siga as instruções comentadas em `supabase/provision_admin.sql`: crie primeiro a conta pelo Supabase Auth, substitua o e-mail de exemplo no SQL e execute o provisionamento uma única vez. Proteja a conta administrativa com MFA e conceda esse papel somente a pessoas autorizadas.

### 5. Executar localmente

Como o app usa módulos JavaScript, sirva os arquivos por HTTP em vez de abrir as páginas diretamente com `file://`:

```bash
python3 -m http.server 8000
```

Abra [http://localhost:8000](http://localhost:8000). Para testar OAuth e instalação do PWA, inclua os endereços locais nas URLs permitidas do Supabase. Service workers exigem HTTPS, exceto em `localhost`.

### 6. Publicar

Publique os arquivos estáticos na raiz de um host HTTPS. Configure o domínio de produção e os redirecionamentos de autenticação no Supabase. Após o deploy, valide os acessos de aluno e treinador, as permissões, o carregamento de recursos e a instalação PWA.

## 🗂️ Estrutura do projeto

```text
.
├── assets/images/          # Logo e imagens da aplicação
├── css/                    # Estilos, tokens visuais e componentes
├── docs/screenshots/       # Capturas públicas para este README
├── js/                     # Autenticação e módulos da aplicação
├── supabase/
│   ├── migrations/         # Migrações SQL versionadas
│   └── provision_admin.sql # Provisionamento administrativo
├── admin.html              # Painel do treinador
├── aluno.html              # Área autenticada do aluno
├── index.html              # Entrada da aplicação
├── login.html              # Entrar e criar conta
├── manifest.webmanifest    # Metadados de instalação PWA
└── sw.js                   # Cache do app shell
```

## 🔐 Segurança e privacidade

- A autorização real dos dados deve ser aplicada no banco por meio de **RLS**; a interface não substitui as políticas do servidor.
- Mantenha credenciais privilegiadas e a chave `service_role` fora do código cliente e do histórico Git.
- Limite os redirecionamentos de autenticação e provedores OAuth aos domínios usados pelo projeto.
- Proteja a conta administrativa com MFA e revise permissões de banco e Storage.
- Revise as migrações antes de executá-las em um banco que já contenha dados.

## 🎨 Identidade visual

A marca oficial usada pelo app está em [`assets/images/logo-box.png`](assets/images/logo-box.png). Os selos deste README são gerados pelo [Shields.io](https://shields.io/); os ícones da interface usam [Font Awesome](https://fontawesome.com/).

## 🤝 Contribuição

Sugestões e melhorias são bem-vindas. Para contribuir, crie uma branch dedicada, mantenha as alterações focadas e abra um pull request com uma descrição clara e instruções de validação.

## 📄 Licença

Não há arquivo de licença neste repositório. Até que uma licença seja adicionada, todos os direitos permanecem reservados; consulte o responsável pelo projeto antes de reutilizar ou redistribuir o código.

---

<div align="center">
  <sub>Feito para a comunidade do BOX Jardim Silvina.</sub>
</div>
