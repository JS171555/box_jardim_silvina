# Revisão técnica — BOX Jardim Silvina

**Data:** 1º de novembro de 2026
**Escopo:** revisão estática do repositório `JS171555/box_jardim_silvina`, com correções locais conservadoras.
**Estado:** a migration documentada não foi aplicada ao projeto Supabase remoto.

## Resumo executivo

A revisão identificou riscos concretos de respostas fora de ordem na navegação semanal do painel administrativo e políticas permissivas para leitura de `app_settings` e atualização de campos do perfil. Também confirmou divergência na cor do tema PWA e dependências visuais/de runtime carregadas exclusivamente de CDNs, indisponíveis quando esses serviços falham ou o dispositivo fica offline.

Foram implementados três ajustes funcionais/segurança e uma atualização de documentação: descarte de resposta obsoleta ao carregar semanas no admin; nova migration para restringir leitura de configurações às chaves públicas e proteger campos adicionais do perfil; alinhamento de cores do manifesto; incremento da versão do cache do service worker; e instruções de aplicação da migration. Não foram alterados o layout nem funcionalidades deliberadamente.

## Achados e ações

### 1. Navegação semanal podia renderizar uma resposta antiga — corrigido

**Evidência:** `js/admin.js`, `tabTreinos()` capturava implicitamente `weekStart` ao construir a consulta. A resposta de uma consulta iniciada antes de outra navegação podia substituir os dados da semana selecionada mais recentemente.

**Causa:** operações assíncronas concorrentes sem verificação de atualidade antes de atualizar `cache` e `main`.

**Correção:** a função agora captura a semana solicitada, usa esse valor na consulta e no rótulo, e descarta a resposta se `weekStart` tiver mudado enquanto a consulta estava pendente.

**Impacto esperado:** respostas de semanas antigas deixam de substituir a semana atualmente selecionada. A correção foi estática; a simulação de latências concorrentes em navegador ainda precisa ser feita.

### 2. Leitura ampla de `app_settings` — mitigado por nova migration

**Evidência:** `001_foundation.sql` concedia leitura de qualquer linha da tabela a qualquer usuário autenticado (`USING (true)`). O app usa `whatsapp_number`; as migrations também inicializam `box_name` e `timezone`.

**Causa:** política RLS por tabela, sem filtrar as chaves efetivamente públicas.

**Correção:** `005_security_tightening.sql` recria a política de leitura para usuários autenticados, permitindo as chaves `box_name`, `timezone` e `whatsapp_number`; administradores mantêm leitura irrestrita. A gravação administrativa existente permanece protegida por `is_admin()`.

**Impacto esperado:** novas linhas com outras chaves não ficam automaticamente visíveis para alunos autenticados. Segredos não devem ser armazenados nessa tabela; valores públicos devem ser mantidos separados de qualquer configuração confidencial.

**Validação requerida no Supabase:** aplicar a migration depois de confirmar o histórico local/remoto de migrações e testar leitura com contas de aluno e administrador. Não foi feita conexão nem alteração no projeto remoto.

### 3. Atualização própria de perfil permitia alterar campos além do fluxo da interface — mitigado por nova migration

**Evidência:** a política `profiles_update_own` limita a linha pelo `id`, e a função anterior protegia `id`, `email`, `status` e `joined_at`, mas não `avatar_url` ou `created_at`. O cliente (`js/profile.js`) precisa atualizar `display_name`, `profile_setup_done` e `avatar_path`.

**Causa:** campos enviados pela interface não constituem uma fronteira de segurança; a API pode receber chamadas diretas.

**Correção:** a função de proteção na migration 005 também impede que usuários não administradores alterem `avatar_url` e `created_at`, preservando o fluxo do cliente. O trigger existente mantém a atualização automática de `updated_at`.

**Validação requerida no Supabase:** testar como aluno atualizações permitidas e tentativas diretas de alterar os campos protegidos; testar o fluxo de perfil e a edição administrativa. A migration não foi aplicada remotamente.

### 4. Cores do tema inconsistentes — corrigido

**Evidência:** o manifesto usava `#050502`, enquanto as páginas HTML declaravam `#070806` nas meta tags `theme-color`.

**Correção:** `background_color` e `theme_color` do `manifest.webmanifest` foram alinhados para `#070806`. A versão do cache do SW foi incrementada de `v8` para `v9`, para que a atualização dos recursos pré-cacheados possa ser instalada pelos clientes.

**Impacto esperado:** inicialização/instalação do PWA fica visualmente alinhada à cor declarada pelas páginas. A verificação em Chrome Android e Safari iOS depende de instalação real.

### 5. Dependências externas sem fallback completo offline — pendente

**Evidência:** Font Awesome e GSAP vêm do cdnjs; fontes do Google Fonts são importadas por CSS; o cliente Supabase é importado do jsDelivr. O service worker não intercepta recursos cross-origin e seu app shell contém recursos locais.

**Impacto:** offline ou indisponibilidade dos CDNs pode remover ícones, fontes e animações; a indisponibilidade do módulo Supabase pode impedir o início da aplicação autenticada. Dados/autenticação Supabase continuam dependentes de rede.

**Próximo passo recomendado:** testar bloqueio de cada CDN e modo offline antes de decidir se vale hospedar localmente dependências visuais/runtime. Nenhum recurso foi copiado ou removido nesta alteração, evitando mudança grande de bundle e licença sem validação.

### 6. Itens de ambiente que o repositório não permite confirmar

A cópia analisada não contém credencial `service_role`; a chave publishable/anon encontrada no cliente é compatível com uso frontend, mas permissões efetivas dependem do projeto remoto. Não foram inspecionados o dashboard Supabase, políticas realmente implantadas, configurações de Auth/MFA/redirect/rate-limit, conteúdo do Storage ou cabeçalhos servidos pelo host. Também não foi encontrada configuração de deploy/CSP versionada nem uma suíte de testes/CI.

Recomenda-se inspecionar os headers HTTP do domínio publicado e configurar CSP, `X-Content-Type-Options`, política de referrer e HSTS de acordo com as origens realmente utilizadas. Não foi criado um cabeçalho CSP às cegas, porque scripts, fontes, imagens, Supabase e OAuth precisam ser inventariados no host real.

## Validações executadas

- `node --check` em todos os arquivos `js/*.js` e `sw.js`: sucesso.
- Parse JSON de `manifest.webmanifest`: sucesso.
- Verificação de que as quatro páginas HTML declaram `theme-color` compatível: sucesso.
- Verificação de existência dos recursos locais listados no app shell do service worker: sucesso.
- `git diff --check`: sucesso.

## Validações não executadas

Não foram realizados testes de navegador, testes em aparelhos iPhone/iPad ou Android reais, testes de instalação/atualização/offline da PWA, autenticação ao vivo, testes de RLS no PostgREST, execução da migration em um banco PostgreSQL/Supabase, Lighthouse, nem inspeção de headers de produção. Portanto, os resultados acima não constituem certificação de segurança nem validação cross-device.

## Plano de teste recomendado

1. Em ambiente Supabase de teste, aplicar `005_security_tightening.sql` após as migrations anteriores; como aluno, consultar as três chaves permitidas e confirmar bloqueio de outras chaves; como administrador, confirmar leitura e escrita previstas.
2. Como aluno, alterar `display_name`, `profile_setup_done` e `avatar_path`; tentar alterar `avatar_url`, `created_at`, `status` e `email` por chamada direta e confirmar rejeição/proteção. Repetir como administrador para confirmar o fluxo autorizado.
3. No admin, atrasar uma consulta de semana, navegar duas semanas antes da resposta e confirmar que o conteúdo final corresponde à semana atualmente selecionada.
4. Atualizar uma instalação PWA existente e confirmar que o service worker `v9` ativa sem deixar o app em tela branca; testar também cache/offline das páginas locais.
5. Em iOS/Safari e Android/Chrome, testar login, logout, instalação, carregamento de fontes/ícones e telas autenticadas com e sem rede; bloquear cdnjs, Google Fonts e jsDelivr individualmente.
6. No host de produção/staging, validar headers e CSP no navegador e testar redirecionamentos OAuth e APIs Supabase sob a política efetiva.
