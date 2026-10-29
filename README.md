<div align="center">
  <img src="assets/images/logo-box.png" alt="Logo do BOX Jardim Silvina" width="180" />
  <h1>BOX Jardim Silvina</h1>
  <p><strong>Treinos, presença e evolução — em um só lugar.</strong></p>
  <p>
    <img alt="Status" src="https://img.shields.io/badge/status-em%20desenvolvimento-f4c430?style=for-the-badge" />
    <img alt="Interface" src="https://img.shields.io/badge/interface-pt--BR-2ea44f?style=for-the-badge" />
    <img alt="PWA" src="https://img.shields.io/badge/PWA-instal%C3%A1vel-5a45ff?style=for-the-badge&logo=pwa" />
    <img alt="Supabase" src="https://img.shields.io/badge/backend-Supabase-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" />
  </p>
  <p>
    <a href="#sobre-o-projeto">Sobre</a> ·
    <a href="#funcionalidades">Funcionalidades</a> ·
    <a href="#configuracao">Configuração</a> ·
    <a href="#estrutura">Estrutura</a>
  </p>
</div>

---

## Sobre o projeto

O **BOX Jardim Silvina** é uma aplicação web responsiva para apoiar a rotina de um box de treinamento funcional. O projeto reúne uma área do aluno e um painel administrativo, com autenticação e dados gerenciados pelo Supabase. Também pode ser instalado como aplicativo (PWA) em dispositivos compatíveis.

A experiência do aluno foi pensada para acompanhar a rotina de treino: consultar a programação, registrar presença, lançar resultados e visualizar a própria evolução. O treinador pode organizar treinos e acompanhar a operação pelo painel administrativo.

> Aplicação em desenvolvimento. Recursos disponíveis dependem da configuração do projeto Supabase e das migrações aplicadas.

## Funcionalidades

### Área do aluno

- Cadastro e acesso por e-mail e senha, login com Google e recuperação de senha.
- Perfil com nome e foto de avatar.
- Programação semanal e consulta aos detalhes do treino do dia, incluindo movimentos, aquecimento, mobilidade, equipamentos, escalas e orientações.
- Início e conclusão de sessões, com registro de resultados como tempo, rounds, repetições e carga.
- Check-in diário e histórico de presenças, treinos e sequência.
- Gamificação com XP, níveis, conquistas, rankings e o recurso “O Trono”.
- Consulta a eventos, inscrições e loja com produtos em destaque.

### Painel administrativo

- Gestão de alunos e perfis, com controles de acesso por papel.
- Criação e publicação de treinos, incluindo adaptações individuais.
- Acompanhamento e gestão de presenças.
- Gestão de eventos, participantes e itens da loja.
- Registro de ações administrativas para auditoria.

### Aplicativo instalável

O projeto inclui manifesto, ícones para diferentes tamanhos, suporte a ícone maskable e service worker para cache do app shell. O cache melhora a disponibilidade de arquivos da interface, mas **não torna os dados e a autenticação do Supabase disponíveis offline**.

## Tecnologias

- **Frontend:** HTML, CSS e JavaScript nativo com módulos ES.
- **Backend e dados:** Supabase Auth, PostgreSQL, Row Level Security (RLS), funções RPC e Storage.
- **PWA:** Web App Manifest, service worker e cache de recursos estáticos.
- **Ícones da interface:** Font Awesome.

## Configuração

### Pré-requisitos

- Um projeto Supabase.
- Um servidor web local ou hospedagem estática com suporte a HTTPS em produção.
- Git, caso deseje clonar o repositório.

### 1. Obtenha o código

```bash
git clone https://github.com/JS171555/box_jardim_silvina.git
cd box_jardim_silvina
```

### 2. Configure o Supabase

No painel do Supabase, configure a autenticação e os provedores desejados. Em **Authentication → URL Configuration**, inclua os endereços locais e de produção permitidos para o site e para os redirecionamentos de autenticação. Para login com Google, habilite e configure também o provedor Google no Supabase.

Abra `js/config.js` e confira os valores de `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com os dados do seu projeto (Supabase → **Settings → API**). O arquivo deve conter somente a URL do projeto e a chave publicável/anon. **Nunca use nem publique a chave `service_role` no navegador.**

> O repositório já contém uma configuração de cliente Supabase. Ao usar outra instância, substitua esses valores pelos da sua própria instância.

### 3. Prepare o banco de dados

No SQL Editor do Supabase, aplique, em ordem crescente, os scripts disponíveis em `supabase/migrations/`:

1. `001_foundation.sql`
2. `002_training.sql`
3. `003_gamification.sql`
4. `004_events_store.sql`

As migrações criam as estruturas, políticas RLS e funções utilizadas pela aplicação. Revise cada script e confirme que ele corresponde ao estado do seu banco antes de reaplicá-lo.

### 4. Crie a conta administrativa

Siga as instruções comentadas em `supabase/provision_admin.sql`: crie primeiro a conta do treinador pelo Supabase Auth, substitua o e-mail de exemplo no SQL e execute o provisionamento manual uma única vez. O esquema restringe a existência de um administrador ativo; recomenda-se habilitar MFA para essa conta.

### 5. Execute localmente

Como o frontend usa módulos JavaScript, sirva os arquivos por HTTP em vez de abrir o HTML diretamente com `file://`. Uma opção simples com Python:

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`. Para testar login OAuth e instalação PWA, configure também os endereços locais correspondentes nas URLs permitidas do Supabase. O suporte a service worker e instalação depende de contexto seguro (HTTPS), exceto em `localhost`.

### 6. Publique

Publique os arquivos estáticos na raiz de um host compatível com HTTPS. Configure no Supabase a URL de produção e os redirecionamentos de autenticação. Depois de publicar, valide o fluxo de login, as permissões de aluno e administrador, o carregamento dos recursos e a instalação do PWA.

## Estrutura do repositório

```text
.
├── assets/images/       # Logo e imagens da aplicação
├── css/                 # Estilos, tokens visuais e componentes
├── js/                  # Autenticação, treinos, presença, eventos e gamificação
├── supabase/
│   ├── migrations/      # Migrações SQL versionadas
│   └── provision_admin.sql
├── admin.html           # Painel administrativo
├── aluno.html           # Área autenticada do aluno
├── index.html           # Entrada da aplicação
├── login.html           # Acesso e cadastro
├── manifest.webmanifest # Metadados de instalação PWA
└── sw.js                # Cache do app shell
```

## Segurança e privacidade

- A autorização dos dados deve ser aplicada no banco por meio de **RLS**; verificações de interface servem apenas para navegação e não substituem as políticas do servidor.
- Mantenha credenciais privilegiadas e chaves `service_role` fora do código cliente e do histórico Git.
- Restrinja URLs de autenticação e provedores OAuth aos domínios realmente utilizados.
- Conceda o papel administrativo somente à conta responsável e proteja-a com MFA.
- Revise políticas, permissões de Storage e migrações antes de usar o sistema com dados reais.

## Identidade visual e ícones

A logo exibida neste documento é o arquivo original [`assets/images/logo-box.png`](assets/images/logo-box.png), também utilizado pela aplicação. Os selos de tecnologia e status são fornecidos pelo [Shields.io](https://shields.io/) e a interface utiliza ícones do [Font Awesome](https://fontawesome.com/).

## Contribuição

Sugestões e melhorias são bem-vindas. Para contribuir, crie uma branch dedicada, mantenha as alterações focadas e abra um pull request com uma descrição clara do que foi alterado e como validar.

## Licença

Nenhum arquivo de licença foi identificado no repositório. Até que uma licença seja adicionada, todos os direitos permanecem reservados; consulte o responsável pelo projeto antes de reutilizar ou redistribuir o código.

---

<div align="center">
  <sub>Feito para a comunidade do BOX Jardim Silvina.</sub>
</div>
