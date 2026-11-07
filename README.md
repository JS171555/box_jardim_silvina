<div align="center">
  <img src="assets/images/logo-box.png" alt="Logo do BOX Training Jardim Silvina" width="170">
  <h1>BOX Jardim Silvina</h1>
  <p><strong>Treinos, presença e evolução em um só lugar.</strong></p>
  <p>Uma plataforma para conectar alunos e treinador à rotina do box.</p>
  <p>
    <a href="https://js171555.github.io/box_jardim_silvina/login.html"><strong>Abrir o aplicativo</strong></a> ·
    <a href="#apresentação">Ver apresentação</a> ·
    <a href="#executar-localmente">Executar localmente</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/status-em%20evolu%C3%A7%C3%A3o-9BEA00?style=flat-square&amp;labelColor=171A16" alt="Status: em evolução">
    <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-9BEA00?style=flat-square&amp;labelColor=171A16" alt="JavaScript ES Modules">
    <img src="https://img.shields.io/badge/backend-Supabase-3ECF8E?style=flat-square&amp;labelColor=171A16" alt="Backend Supabase">
    <img src="https://img.shields.io/badge/PWA-instal%C3%A1vel-9BEA00?style=flat-square&amp;labelColor=171A16" alt="PWA instalável">
  </p>
</div>

O **BOX Jardim Silvina** é um aplicativo web responsivo para apoiar a rotina de um box de treinamento funcional. Reúne programação de treinos, presença, resultados e evolução dos alunos, com ferramentas de gestão para o treinador.

A interface utiliza HTML, CSS e módulos JavaScript. Autenticação, armazenamento e regras de acesso são integrados ao Supabase. O aplicativo também pode ser instalado como **Progressive Web App (PWA)** em dispositivos compatíveis.

> Uma instalação própria exige configurar o Supabase e aplicar as migrações do banco. Os recursos disponíveis dependem das permissões da conta e da configuração do ambiente.

## Apresentação

<div align="center">
  <img src="docs/media/apresentacao.gif" alt="Apresentação animada do BOX Jardim Silvina, com identidade visual e telas de login, treinos, conquistas e ranking" width="360">
  <p><sub>Apresentação visual do projeto, convertida do vídeo original para GIF.</sub></p>
</div>

<details>
<summary>Ver capturas de login e cadastro</summary>

As capturas abaixo mostram as telas públicas de entrada e criação de conta.

| Entrar | Criar conta |
| :---: | :---: |
| ![Tela de login do BOX Jardim Silvina](docs/screenshots/login.jpg) | ![Tela de criação de conta](docs/screenshots/cadastro.jpg) |

</details>

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Executar localmente](#executar-localmente)
- [Configuração](#configuração)
- [Primeiros passos](#primeiros-passos)
- [Publicação e PWA](#publicação-e-pwa)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Validação da instalação](#validação-da-instalação)
- [Solução de problemas](#solução-de-problemas)
- [Documentação técnica](#documentação-técnica)
- [Contribuição](#contribuição)
- [Licença](#licença)

## Funcionalidades

### Área do aluno

| Recurso | O que oferece |
| --- | --- |
| **Conta e perfil** | Cadastro, login por e-mail e senha, autenticação Google, solicitação de recuperação de senha e perfil com nome e foto. |
| **Programação de treinos** | Agenda semanal, movimentos, aquecimento, mobilidade, equipamentos, escalas e orientações. |
| **Execução e resultados** | Início e conclusão de treinos, com registro de tempo, rounds, repetições ou carga. |
| **Presença** | Check-in, histórico de participação e acompanhamento de sequência. |
| **Evolução** | XP, níveis, conquistas e rankings de XP e frequência. |
| **O Trono** | Destaque para a liderança em XP, com histórico e tempo de permanência. |
| **Recompensas** | Avisos de XP, conquistas e níveis, apresentados por uma fila persistente. |
| **Eventos** | Consulta à programação e inscrição em eventos disponíveis. |
| **Loja** | Vitrine de produtos e contato para pedidos pelo WhatsApp. |

### Painel do treinador

- Gestão de alunos, perfis e presenças.
- Criação, edição e publicação de treinos, incluindo adaptações individuais.
- Configuração de regras de XP, níveis e conquistas.
- Gestão de eventos, inscrições e validação de participação.
- Gestão da vitrine de produtos e do contato de WhatsApp.
- Registro de ações administrativas para auditoria.

As permissões são aplicadas no banco por políticas RLS e funções RPC. A separação entre as telas de aluno e treinador complementa essa autorização.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | HTML, CSS e JavaScript nativo com módulos ES. |
| Backend | [Supabase](https://supabase.com/): Auth, PostgreSQL, Storage, RLS e funções RPC. |
| Animações e ícones | [GSAP](https://gsap.com/) e [Font Awesome](https://fontawesome.com/). |
| Instalação e cache | Web App Manifest, Service Worker e Cache API. |
| Hospedagem publicada | GitHub Pages. |

O projeto é estático e não exige etapa de build. O cliente Supabase e recursos visuais externos são carregados por CDN.

## Executar localmente

### Pré-requisitos

- Git para clonar o repositório.
- Python 3 ou outro servidor de arquivos estáticos.
- Navegador moderno com suporte a módulos JavaScript.
- Projeto Supabase configurado e conexão com a internet.

### Clonar e iniciar

```bash
git clone https://github.com/JS171555/box_jardim_silvina.git
cd box_jardim_silvina
python3 -m http.server 8000
```

Abra [http://localhost:8000](http://localhost:8000). Para utilizar autenticação e dados, conclua a configuração abaixo.

Sirva os arquivos por HTTP; abrir as páginas com `file://` não oferece o ambiente necessário para os módulos e o Service Worker. O endereço `localhost` permite testar recursos PWA durante o desenvolvimento.

## Configuração

### 1. Conectar ao Supabase

Crie um projeto Supabase e copie a URL e a chave pública. Em [`js/config.js`](js/config.js), substitua os valores existentes pelos da sua instalação, mantendo os nomes dos exports:

```javascript
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "SUA_CHAVE_PUBLICA";
export const AVATAR_BUCKET = "avatars";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
```

Use a chave pública `publishable` ou a chave legada `anon`. **Nunca inclua chaves `service_role`, chaves secretas ou credenciais de provedores nos arquivos servidos ao navegador.**

### 2. Preparar o banco de dados

Em uma instalação nova, execute os arquivos no **SQL Editor** do Supabase, na ordem indicada:

| Ordem | Migração | Responsabilidade |
| --- | --- | --- |
| 1 | [`001_foundation.sql`](supabase/migrations/001_foundation.sql) | Perfis, papéis, configurações, auditoria e armazenamento de avatares. |
| 2 | [`002_training.sql`](supabase/migrations/002_training.sql) | Treinos, adaptações individuais, sessões, resultados e presença. |
| 3 | [`003_gamification.sql`](supabase/migrations/003_gamification.sql) | XP, níveis, conquistas, rankings e O Trono. |
| 4 | [`004_events_store.sql`](supabase/migrations/004_events_store.sql) | Eventos, inscrições, participação, produtos e imagens. |
| 5 | [`005_security_tightening.sql`](supabase/migrations/005_security_tightening.sql) | Restrições adicionais de leitura de configurações e edição de perfil. |
| 6 | [`006_reward_notifications.sql`](supabase/migrations/006_reward_notifications.sql) | Fila persistente de notificações de recompensas. |

**Em bancos existentes, confira o histórico e aplique apenas as migrações pendentes.** Os arquivos têm dependências entre si e não devem ser reaplicados indiscriminadamente.

A migração 006 precisa estar aplicada antes de usar o frontend que consulta as funções de notificação de recompensas. Ela registra os avisos na mesma transação da recompensa e oferece funções de reivindicação e confirmação para a conta autenticada.

### 3. Configurar autenticação e redirecionamentos

No Supabase, configure o provedor de e-mail, a confirmação de cadastro e o envio de mensagens conforme a sua instalação.

Em **Authentication → URL Configuration**, defina o **Site URL** e autorize os retornos utilizados por [`js/auth.js`](js/auth.js):

| Ambiente | Site URL | URLs de redirecionamento |
| --- | --- | --- |
| Desenvolvimento | `http://localhost:8000` | `http://localhost:8000/aluno.html` e `http://localhost:8000/login.html` |
| Produção no GitHub Pages | `https://js171555.github.io/box_jardim_silvina/` | `https://js171555.github.io/box_jardim_silvina/aluno.html` e `https://js171555.github.io/box_jardim_silvina/login.html` |

O cadastro e o login Google retornam para `aluno.html`; o envio de recuperação de senha usa `login.html`. Em um domínio próprio ou fork, substitua as URLs pelos endereços reais da instalação, incluindo o subdiretório quando houver.

#### Login com Google (opcional)

1. No Google Cloud Console, crie um cliente OAuth do tipo **Aplicativo da Web**.
2. Nas URIs de redirecionamento autorizados, adicione o callback exibido pelo provedor Google no Supabase, normalmente `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
3. No Supabase, habilite o provedor Google e informe o Client ID e o Client Secret.
4. Confirme que a URL completa de `aluno.html` está autorizada no Supabase.

O Client Secret deve ficar apenas na configuração do provedor. Consulte os guias oficiais de [redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls) e [login com Google](https://supabase.com/docs/guides/auth/social-login/auth-google).

### 4. Provisionar o treinador

Siga os comentários de [`supabase/provision_admin.sql`](supabase/provision_admin.sql):

1. Crie a conta do treinador no Supabase Auth, com e-mail e senha.
2. Substitua o e-mail de exemplo nas duas ocorrências do script.
3. Execute o provisionamento uma única vez no SQL Editor.
4. Entre em `admin.html` com a conta provisionada.

O banco permite **um administrador ativo** por meio do índice `one_active_admin`. Conceda esse papel apenas à pessoa responsável pela gestão e proteja a conta com MFA no Supabase Auth, conforme as orientações do script.

## Primeiros passos

**Treinador:** publique os treinos da semana, confira os alunos e cadastre eventos e produtos. Para os pedidos da loja, configure o número de WhatsApp no painel.

**Aluno:** crie sua conta, complete o perfil, consulte a programação e registre sua participação. Acompanhe resultados, presença, XP e conquistas na área autenticada.

| Entrada | Arquivo |
| --- | --- |
| Página inicial | [`index.html`](index.html) |
| Login e cadastro | [`login.html`](login.html) |
| Área do aluno | [`aluno.html`](aluno.html) |
| Painel do treinador | [`admin.html`](admin.html) |

## Publicação e PWA

Publique os arquivos estáticos em um host com **HTTPS**, preservando os diretórios. Atualize as configurações públicas e os redirecionamentos do Supabase para o endereço publicado.

Antes de disponibilizar a instalação, confirme que `manifest.webmanifest`, `sw.js` e os ícones estão acessíveis e que as migrações necessárias foram aplicadas.

### Instalar no dispositivo

- **Android:** abra o site no Chrome e use **Instalar app** ou **Adicionar à tela inicial**, quando disponível.
- **iPhone:** abra o site no Safari e selecione **Compartilhar → Adicionar à Tela de Início**.

O manifesto define `login.html` como entrada do aplicativo instalado.

### Funcionamento offline

O Service Worker mantém os arquivos locais da interface em cache. Isso pode permitir a abertura de telas já armazenadas pelo navegador.

**Autenticação e dados do Supabase dependem de conexão.** A instalação como PWA não garante o funcionamento completo offline; dependências externas de CDN também podem ficar indisponíveis.

## Estrutura do projeto

```text
box_jardim_silvina/
├── assets/images/          # Logo e imagens da aplicação
├── css/                    # Tokens visuais, componentes e estilos
├── docs/
│   ├── media/              # Apresentação animada em GIF
│   ├── screenshots/        # Capturas de login e cadastro
│   └── *.md                # Revisões técnicas
├── js/                     # Autenticação e módulos da aplicação
├── supabase/
│   ├── migrations/         # Migrações SQL versionadas
│   └── provision_admin.sql # Provisionamento do treinador
├── admin.html              # Painel do treinador
├── aluno.html              # Área do aluno
├── index.html              # Entrada da aplicação
├── login.html              # Login e cadastro
├── manifest.webmanifest    # Metadados de instalação
└── sw.js                   # Cache dos arquivos da interface
```

## Validação da instalação

Antes de publicar alterações, confira os fluxos em um ambiente de teste:

- Cadastro, confirmação de e-mail, login, logout e redirecionamentos.
- Acesso de aluno e treinador, incluindo bloqueio de operações sem permissão.
- Publicação de treino, check-in, conclusão e registro de resultado.
- XP, conquistas e apresentação dos avisos de recompensas.
- Inscrição em eventos, vitrine e contato pelo WhatsApp.
- Upload de imagens e instalação da PWA no dispositivo desejado.

O repositório não inclui uma suíte de testes automatizados. As revisões técnicas abaixo registram verificações realizadas e pontos que ainda precisam de validação na instalação real.

## Solução de problemas

| Situação | O que verificar |
| --- | --- |
| Login ou dados não carregam | URL e chave pública em `js/config.js`, conexão e migrações aplicadas. |
| Google retorna erro | Provedor habilitado, callback no Google Cloud e URL de `aluno.html` autorizada no Supabase. |
| Painel do treinador não permite acesso | Conta criada no Auth e papel provisionado em `user_roles`. |
| Treino não aparece para o aluno | Data selecionada, estado de publicação e eventuais adaptações individuais. |
| Avisos de recompensa não carregam | Aplicação da migração 006 e permissões das funções RPC. |
| Pedidos pelo WhatsApp não abrem | Número de contato configurado na loja e disponibilidade do produto. |
| Instalação PWA não é oferecida | HTTPS ou `localhost`, suporte do navegador e registro do Service Worker. |

Não desative as políticas RLS para contornar falhas. Revise as permissões do banco e do Storage e mantenha as chaves privilegiadas fora do frontend.

## Documentação técnica

- [Revisão técnica do projeto](docs/revisao-tecnica-2026-11.md): achados, correções, limites das verificações e plano de validação.
- [Revisão de notificações e recompensas](docs/revisao-notificacoes-recompensas.md): funcionamento e validação da fila de avisos.

## Contribuição

Para relatar um problema ou sugerir uma melhoria, [abra uma issue](https://github.com/JS171555/box_jardim_silvina/issues) com os passos para reproduzir, o comportamento esperado e o navegador utilizado. Evite compartilhar credenciais e dados de alunos.

Para propor alterações, crie uma branch dedicada e envie um pull request com o objetivo da mudança e as instruções de validação.

## Licença

O repositório ainda não inclui um arquivo de licença. Consulte o responsável antes de reutilizar ou redistribuir o código e os materiais visuais.
