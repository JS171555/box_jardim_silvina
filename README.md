# BOX Jardim Silvina — Fases 1 a 4

HTML + CSS + JS puro (ES Modules) com Supabase. Sem build.

## Instalação como aplicativo (PWA)

O projeto inclui manifest, ícones Android/iOS, modo standalone e service worker. Publique o site em **HTTPS** (por exemplo, GitHub Pages) para habilitar a instalação; o service worker não funciona em hospedagem HTTP comum nem ao abrir os arquivos diretamente com `file://`. O login e os dados do Supabase ainda precisam de conexão com a internet.

- **Android:** abra a URL publicada no Chrome ou outro navegador compatível. Use **Instalar app** ou **Adicionar à tela inicial** no menu do navegador; a sugestão de instalação pode aparecer automaticamente quando os critérios do navegador forem atendidos.
- **iPhone/iPad:** abra a URL publicada no Safari, toque em **Compartilhar** → **Adicionar à Tela de Início** e confirme em **Adicionar**. No iOS, a instalação é feita por esse menu manualmente, não pelo prompt automático típico do Android. Se o item não aparecer, role as ações no menu Compartilhar e confirme que o site está aberto no Safari, não dentro de outro app.

O manifest usa caminhos relativos para funcionar tanto no domínio raiz quanto em um endereço sob caminho de projeto do GitHub Pages. Após uma atualização, se o app instalado ainda mostrar a versão antiga, feche e reabra-o ou remova-o da tela inicial e instale novamente.

## Já implementado
- Login e cadastro (e-mail/senha), Google, recuperação de senha, logout, sessão persistente.
- Configuração de perfil única (nome + foto opcional) com validação de arquivo (tamanho, assinatura real, compressão WebP).
- Migração SQL: perfis, papéis (1 admin), settings, auditoria, RLS e bucket `avatars`.
- `admin.html` só abre para quem tem papel admin (checado no banco via `is_admin()`).

## Fase 2 (Treinos e presença) — rode `supabase/migrations/002_training.sql`
- Aluno (`aluno.html`, navegação inferior): início com check-in, treino do dia, estatísticas e próximo treino; treino com iniciar/finalizar e resultado por formato; semana; histórico de presença; perfil editável.
- Treinador (`admin.html`): calendário semanal (criar, editar, duplicar, publicar/despublicar), adaptação individual por aluno (restaurar treino compartilhado), presença por data (registro/correção com justificativa obrigatória e auditoria), resumo de frequência e faltas.
- Regras no banco: 1 treino por data; 1 presença por aluno por dia (data em America/Sao_Paulo); 1 sessão por aluno por treino; só dá para iniciar o treino de hoje; finalizar duas vezes é bloqueado; aluno não escreve direto em sessões, resultados nem presença (só pelas funções `check_in`, `start_workout_session`, `finish_workout_session`).
- Check-in é um botão autenticado: não comprova presença física (QR Code fica para depois).
- Sequência = dias de treino programado seguidos com presença; hoje sem check-in não quebra; falta justificada não quebra nem soma.
- Decisão: movimentos ficam em coluna `movements` (jsonb) em `workouts`, em vez de tabela `workout_exercises`.

## Fase 3 (Gamificação) — rode `supabase/migrations/003_gamification.sql`
- **XP:** só nasce em `xp_transactions` (imutável, chave de idempotência única). Caminhos: `check_in` (+20), `finish_workout_session` (+50 treino, +10 resultado válido), presença registrada pelo treinador (mesma chave do check-in), bônus/ajuste manual com justificativa (`admin_grant_xp`) e estorno (`admin_reverse_xp`). Valores editáveis em `xp_rules` (aba Gamificação).
- **Saldo:** `user_xp` é atualizado por trigger; `admin_reconcile_xp()` recalcula a partir do histórico. XP já existente das fases 1–2 é creditado retroativamente na migração.
- **Níveis:** `min_xp(n) = 50·n·(n−1)` (tabela `levels`, 50 níveis; edite no Table Editor). Histórico em `level_history`.
- **Conquistas:** 16 iniciais, desbloqueio único por aluno, avaliadas no servidor em laço limitado (sem recursão). Avaliação acontece no check-in, ao finalizar treino e ao abrir o início/conquistas. O treinador cria e ativa/desativa conquistas.
- **Rankings:** XP (desempate: quem atingiu o total primeiro, depois id) e frequência (30 dias). Aparecem foto, nome, nível e XP; faltas só para o próprio aluno e o treinador.
- **O Trono:** líder = 1º do ranking de XP (>0). `throne_history` registra início/fim de cada reinado; tempo total e dias consecutivos são métricas separadas. Campeões semanal/mensal (maior XP ganho no período) em `leaderboard_periods`.
- Decisões: conquista não é revogada se o XP dela for estornado; o Trono é atualizado a cada mudança de XP (trigger), sem Realtime; eventos/“participação” entram na Fase 4.

## Testes manuais (Fase 3)
- Check-in duas vezes no dia → +20 XP uma vez. Finalizar treino com resultado → +60; sem resultado → +50.
- No console: `supabase.from('xp_transactions').insert(...)` e `supabase.rpc('award_xp',...)` com conta de aluno devem falhar.
- Treinador: bônus sem justificativa → erro; clicar 2x em "Conceder" → 1 transação; estornar → linha negativa, original mantida.
- Dois alunos com XP: o maior aparece no Trono; ao ultrapassá-lo, o reinado anterior ganha data de fim.
- "Reconciliar saldos" → "Todos os saldos estão consistentes."
A sintaxe do SQL e do JS foi validada, mas a Fase 3 ainda não foi executada em um Supabase real.

## Fase 4 (Eventos e loja) — rode `supabase/migrations/004_events_store.sql`
- **Eventos (treinador):** criar/editar com banner (Storage `event-banners`), data/hora em Brasília, local, categoria, regras, link externo (só http/https), XP opcional, status rascunho/publicado/encerrado/cancelado e inscrições liga/desliga. Mudar a data de um evento publicado marca "Data alterada" para os alunos.
- **Eventos (aluno):** lista de futuros e anteriores, detalhe, "Confirmar participação", "Tenho interesse" e cancelar. Clicar não gera XP.
- **Participação:** só o treinador valida (aba Eventos → Participantes), depois do início do evento. O XP do evento é concedido uma única vez por aluno e evento. Conquistas "Primeiro evento" e "Rato de evento" foram adicionadas.
- **Loja:** produtos com imagem (Storage `product-images`), preço opcional, categoria, destaque, disponibilidade, status e reordenação (↑↓). O aluno vê a vitrine e o botão "Pedir pelo WhatsApp" (`wa.me` com mensagem pronta).
- **WhatsApp:** painel do treinador → aba Loja → "WhatsApp do treinador" (DDI + número, só dígitos, ex.: `5511999999999`). Sem número válido, a loja mostra "configuração pendente" e o botão avisa em vez de abrir link quebrado.
- **Imagens:** valida tamanho (5 MB), assinatura real do arquivo e comprime para WebP. Buckets públicos (vitrine); só o treinador escreve.
- **Menu do aluno:** Início, Treino, Ranking, Eventos e Mais (Conquistas, Loja, Semana, Presença, Perfil). O início mostra próximos eventos e produtos em destaque; o perfil ganhou estatísticas e histórico de treinos.
- Preferências do aluno (spec): ainda não há nenhuma preferência definida, então não foi criada tela para isso.

## Testes manuais (Fase 4)
- Treinador cria evento com banner e publica → aluno vê na lista e no início; rascunho não aparece.
- Aluno inscrito num evento futuro; evento passado/cancelado → botões somem.
- Validar participação duas vezes → XP só uma vez. Validar antes do início → erro.
- Arquivo `.txt` renomeado para `.jpg` ou imagem > 5 MB → recusado. Conta de aluno tentando enviar ao bucket → bloqueada.
- Sem WhatsApp configurado → aviso na loja; com número → abre `wa.me` com a mensagem do produto.
A sintaxe do SQL e do JS foi validada; a Fase 4 ainda não foi executada em um Supabase real.

## Falta (Fase 5)
Dashboard administrativo com estatísticas e gráficos, gestão de alunos (listar, suspender/reativar, histórico), configurações (nome, logo, regras, edição de níveis), acabamento de GSAP/acessibilidade, testes automatizados e guia de publicação.
