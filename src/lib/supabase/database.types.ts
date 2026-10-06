/**
 * Tipos do banco de dados.
 *
 * Pode (e deve) ser gerado a partir do schema real, assim o TypeScript avisa
 * quando uma coluna muda de nome ou some:
 *
 *   npx supabase login
 *   npx supabase link --project-ref <referencia-do-projeto>
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * Ate a primeira geracao, vale a versao escrita a mao abaixo, que cobre o que
 * a migration 0002 cria.
 */

export type UserRole = "cliente" | "colaborador" | "desenvolvedor" | "socio";

/** O que a pessoa faz na agência. Diferente de UserRole, que é o acesso. */
/** Os quatro estados da nota fiscal da pessoa (0065). */
export type NfStatus = "enviada" | "aprovada" | "paga" | "recusada";

/**
 * O status do pedido que o cliente abre pelo Portal (0068).
 *
 * **É um quarto vocabulário**, ao lado de `task_status`, `subtask_status` e
 * `content_status`, e pela mesma razão que mantém os três separados: esta
 * tabela responde a outra pergunta — "em que pé está o meu PEDIDO?" —, e
 * nenhum dos três a responde.
 *
 * Sem `cancelada`, que é a lição da 0020, e sem `lida`: "alguém abriu" não é
 * estado do trabalho.
 */
export type SolicitacaoStatus =
  | "nova"
  | "em_analise"
  | "em_andamento"
  | "concluida"
  | "recusada";

export type TeamFuncao =
  | "Atendimento"
  | "Social Media"
  | "Redator"
  | "Design"
  | "Audiovisual"
  | "Trafego"
  | "Desenvolvimento"
  | "Gestao"
  | "Outro";

export type TaskPrioridade = "baixa" | "normal" | "alta" | "urgente";

export type FinTipo = "receita" | "despesa";

/**
 * `atrasado` existe no enum, mas NUNCA é gravado: ele é derivado do
 * vencimento a cada leitura, por `situacaoDoLancamento()` em
 * `lib/dominio/financeiro.ts` e por `situacao_do_lancamento()` no Postgres.
 * Um trigger reescreve para `previsto` quem tentar gravá-lo à mão.
 */
export type FinStatus = "previsto" | "faturado" | "pago" | "atrasado" | "cancelado";

export type ContratoRecorrencia = "mensal" | "trimestral" | "anual" | "pontual";

export type PfTipo = "entrada" | "saida";

export type TaskStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_informacoes"
  | "entregue"
  | "em_aprovacao"
  | "em_ajustes"
  | "concluido"
  | "cancelada";

/** O status da subtarefa — a unidade real de trabalho. */
export type SubtaskStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "aguardando_informacoes"
  | "enviada_aprovacao"
  | "em_ajustes"
  | "concluida";

/** Para onde a aprovação vai no fim. Não é o caminho: toda aprovação passa
 *  primeiro pela rodada interna. */
export type TipoAprovacao = "interna" | "cliente";

export type EscopoRodada = "interna" | "cliente";

/**
 * O que passa por uma rodada de aprovação (migration 0030).
 *
 * **Os três têm dono.** A 0030 criou o par e recusou `post` e `deliverable`
 * de propósito, com a frase "quem acrescentar o tipo acrescenta a regra na
 * mesma migration"; a 0032 cumpriu isso para o post e a 0033 para o
 * entregável. A frase fica de pé assim mesmo: ela é a regra para o quarto
 * tipo, se um dia existir.
 */
export type TipoDeConteudo = "subtask" | "post" | "deliverable";

/**
 * Os sete estados de um conteúdo do cliente (`content_status` no Postgres).
 *
 * Três chaves se escrevem igual às de task e de subtarefa
 * (`aguardando_informacoes`, `em_aprovacao`), e é de propósito: o cliente e a
 * equipe usam a mesma palavra para a mesma coisa, e um selo só evita dois
 * amarelos diferentes na mesma tela.
 */
export type ContentStatus =
  | "aguardando_informacoes"
  | "em_producao"
  | "em_aprovacao"
  | "ajustes"
  | "aprovado"
  | "rejeitado"
  | "stand_by";

/** O que o material É. O ícone e o jeito de abrir saem daqui. */
export type MaterialTipo =
  | "video"
  | "artigo"
  | "pdf"
  | "curso_externo"
  | "template"
  | "aula_interna";

export type RecCategoria =
  | "filme"
  | "serie"
  | "livro"
  | "curso"
  | "ferramenta"
  | "podcast"
  | "referencia"
  | "outro";

/**
 * O desfecho de uma rodada.
 *
 * **`rejeitada` entrou na migration 0032, e vale para MATERIAL.** O Portal tem
 * três botões — Aprovar, Rejeitar, Solicitar ajustes — e os dois últimos não
 * são a mesma decisão: um diz "mude isto e volte", o outro diz "não". Post e
 * entregável de campanha aceitam os três, porque os dois usam
 * `content_status`, que tem `rejeitado`. Etapa de demanda continua com dois
 * desfechos, e o banco recusa `rejeitada` nela: não existe `subtask_status`
 * que signifique recusada.
 */
export type StatusRodada =
  | "pendente"
  | "aprovada"
  | "ajustes_solicitados"
  | "rejeitada";

/** As redes em que um post é publicado (`plataforma_social`, 0032). */
/**
 * O que a tela DESENHA (migration 0042).
 *
 * **Não confundir com `posts.formato`**, que é onde o material vai ao ar —
 * Feed, Stories, Reels — e continua texto porque nome comercial de plataforma
 * muda a cada temporada. Estes três não mudam: ou é uma imagem, ou são várias
 * em ordem, ou toca.
 *
 * É enum e não texto porque decide qual editor aparece: um `"Carrossel"` com
 * C maiúsculo faria a faixa de slides sumir sem erro nenhum.
 */
export type PostMidia = "imagem" | "carrossel" | "video";

/** Um slide de carrossel, dentro de `post_versions.arquivos`. */
export type ArquivoDaVersao = {
  url: string;
  thumbnail_url?: string | null;
  nome?: string | null;
};

export type PlataformaSocial =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "pinterest";

/**
 * O papel de um elo da corrente do social (`social_flow_papel`, 0087).
 *
 * **ELE EXISTE PARA O PRODUTO PARAR DE PERGUNTAR PELO NOME.** Até a 0087 a
 * corrente era fixa — Pauta, Conteúdo, Layout, Envio, Programar — e 'Envio'
 * podia ser uma palavra: ela aparecia escrita em SEIS comparações. Com fluxos
 * editáveis, um que chame aquele elo de "Entrega" ficaria sem portão do
 * cliente nenhum, sem erro em lugar nenhum.
 *
 * As duas razões que a 0076 escreveu para excluir o Envio e o Programar da
 * lista de portões viraram dados:
 *
 * - `producao` — o trabalho de alguém. PODE virar portão do cliente.
 * - `entrega` — ela É o portão: enviar ao cliente É abrir a rodada dele
 *   (0032). Uma por fluxo, nem zero nem duas.
 * - `pos_entrega` — vem DEPOIS da decisão. Pôr o cliente para aprová-la seria
 *   pedir o aval de um trabalho que só existe porque ele já aprovou.
 */
export type SocialFlowPapel = "producao" | "entrega" | "pos_entrega";

/**
 * O ciclo de vida da campanha como PROJETO (`campaign_status`, 0033).
 *
 * Distinto de `ContentStatus`, e de propósito: aquele é o estado de uma peça
 * no fluxo de aprovação, este é o da campanha inteira. "Em aprovação" não quer
 * dizer nada sobre uma campanha; "finalizada" não quer dizer nada sobre um
 * arquivo.
 */
export type CampaignStatus =
  | "planejamento"
  | "ativa"
  | "finalizada"
  | "cancelada";

/**
 * Um nó da árvore que o template guarda em `estrutura_json`.
 *
 * `itens` presente e vazio, com `quantidade`, é o caso do Feed/Storys: quantos
 * são se decide na criação da campanha, porque muda a cada mês. A tela lê esse
 * número como sugestão e gera "Feed/Story 1", "Feed/Story 2" — escrever quinze
 * linhas iguais no template seria fixar um número que nunca é o mesmo.
 */
export type NoDoTemplate = {
  nome: string;
  itens?: NoDoTemplate[];
  quantidade?: number;
};

export type EstruturaDeTemplate = NoDoTemplate[];

/**
 * Uma pergunta do roteiro de briefing (0068).
 *
 * O roteiro existe porque um campo de texto livre chamado "descreva o que você
 * precisa" devolve "uma arte pro insta", e a primeira mensagem da conversa é
 * sempre a mesma pergunta.
 */
export type CampoDoRoteiro = {
  chave: string;
  rotulo: string;
  tipo: "texto" | "texto_longo" | "escolha" | "data";
  obrigatorio?: boolean;
  opcoes?: string[];
  ajuda?: string;
};

export type NotificationTipo =
  | "task"
  | "aprovacao"
  | "academy"
  | "recomendacao"
  | "full_days"
  | "equipe"
  | "cliente"
  | "sistema"
  // 0055: o aviso de que você entrou num evento.
  | "evento"
  // 0068: o pedido que o cliente abriu pelo Portal, e o que acontece com ele.
  | "solicitacao"
  // 0069: o equipamento que passou para a sua mao, e o que acontece com ele.
  | "comodato";

/** O que o evento é. Decide a cor quando `events.cor` não diz outra coisa. */
export type EventoTipo =
  | "convencao"
  | "feira"
  | "lancamento"
  | "reuniao"
  | "treinamento"
  | "feriado_cliente"
  | "outro";

/**
 * As SEIS origens da `calendar_events`.
 *
 * O nome de cada uma é o que a view escreve na coluna `tipo`, e é por isso
 * que ele fica em INGLÊS de um lado e em português do outro: aqui é valor de
 * dado, e o rótulo que a pessoa lê sai de `ROTULOS_DE_CAMADA`.
 *
 * **`task` e `subtarefa` saíram na 0077**, por decisão do usuário: a demanda
 * e a etapa vivem em Minhas Tasks e em Gestão de Tasks. Os dois valores saem
 * do tipo junto com os `union all` que os produziam — um valor que a view não
 * escreve mais é um filtro que o compilador aceitaria e o banco responderia
 * com zero linhas, calado.
 */
export type TipoNoCalendario =
  | "ausencia"
  | "evento"
  | "post"
  | "campanha"
  | "entregavel"
  // A etapa da corrente de um post, que nasceu como oitava origem na 0059 e
  // hoje é a sexta. Ela é diferente de `post` — aquele é o dia em que a peça
  // vai ao ar, este é o dia em que o trabalho de alguém precisa estar pronto,
  // e as duas datas raramente são a mesma. Sem esta camada, a etapa do redator
  // tinha prazo na tabela e não aparecia no calendário de ninguém.
  | "etapa_de_post";

export type SkillNivel = "iniciante" | "intermediario" | "avancado" | "especialista";

/**
 * O QUE O EQUIPAMENTO E (migration 0069).
 *
 * Enum e nao texto porque e ele que decide o ICONE quando o equipamento nao
 * tem foto: um "Notebook" com N maiusculo faria o icone sumir sem erro nenhum.
 * E a mesma separacao de `posts.midia` (enum) e `posts.formato` (texto).
 */
export type AssetTipo =
  | "notebook"
  | "desktop"
  | "monitor"
  | "celular"
  | "tablet"
  | "camera"
  | "lente"
  | "microfone"
  | "iluminacao"
  | "tripe"
  | "headset"
  | "teclado"
  | "mouse"
  | "hd_externo"
  | "acessorio"
  | "outro";

/** Onde o equipamento esta. Escrito pelo emprestimo, nunca pela tela. */
export type AssetStatus = "disponivel" | "emprestado" | "manutencao" | "baixado";

/** Quatro degraus, e nao cinco: escala com meio-degrau duas pessoas leem diferente. */
export type AssetEstado = "novo" | "bom" | "regular" | "ruim";

/** Cada linha da folha corrida do equipamento. */
export type AssetEventoTipo =
  | "cadastrado"
  | "emprestado"
  | "aceito"
  | "devolvido"
  | "manutencao"
  | "baixado"
  | "problema"
  | "voltou";

export type HrTipo = "ferias" | "licenca" | "ausencia";
export type HrStatus = "pendente" | "aprovada" | "reprovada" | "cancelada";
/**
 * De onde veio o registro (migration 0037).
 *
 * `solicitacao` é o caminho de sempre: a pessoa propõe, o sócio responde.
 * `lancamento_retroativo` é a gestão registrando um período que já aconteceu,
 * que nasce aprovado e não passa por fila nenhuma. `importacao` é o mesmo
 * fato vindo de um arquivo, e existe separado para a auditoria saber
 * distinguir os dois.
 */
export type HrOrigem = "solicitacao" | "lancamento_retroativo" | "importacao";

/**
 * Como uma demanda recorrente se materializa (migration 0040).
 *
 * `mensal_agrupada`: uma task por mês, com uma etapa por ocorrência dentro
 * dela — o modo certo para trabalho diário, porque o board mostra uma linha
 * por mês e não trinta. `task_por_ocorrencia`: uma task inteira a cada
 * repetição, com as etapas do modelo dentro.
 */
export type RecorrenciaModo = "mensal_agrupada" | "task_por_ocorrencia";
export type RecorrenciaFrequencia = "diaria" | "semanal" | "quinzenal" | "mensal";
/** Mensal ou trimestral: como o feedback de desenvolvimento é gerado (0075). */
export type FeedbackPeriodicidade = "mensal" | "trimestral";

/**
 * Os seis estados de um relatório de feedback (0075).
 *
 * `dados_insuficientes` e `descartado` são desfechos e não erros: o primeiro
 * diz que o período não tinha o que dizer, o segundo que a gestão leu e não
 * enviou. Sem os dois, a ausência de relatório significaria duas coisas
 * diferentes e ninguém saberia qual.
 *
 * **Só `enviado` chega à pessoa**, e quem garante é `feedback_reports_select`.
 */
export type FeedbackStatus =
  | "gerando"
  | "rascunho"
  | "revisado"
  | "enviado"
  | "descartado"
  | "dados_insuficientes";

export type PresencaStatus =
  | "presente"
  | "remoto"
  | "ferias"
  | "licenca"
  | "ausente"
  | "folga"
  | "feriado";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          nome: string;
          role: UserRole;
          avatar_url: string | null;
          ativo: boolean;
          deve_trocar_senha: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nome: string;
          role?: UserRole;
          avatar_url?: string | null;
          ativo?: boolean;
          deve_trocar_senha?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string;
          nome?: string;
          role?: UserRole;
          avatar_url?: string | null;
          ativo?: boolean;
          deve_trocar_senha?: boolean;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          nome_empresa: string;
          /**
           * O endereco do portal: /portal/<slug>. Unico, gerado do nome pelo
           * gatilho `clients_slug` (migration 0009). Nulo so no instante entre
           * o insert e o gatilho -- nenhuma linha gravada chega ao cliente sem
           * slug --, mas fica nulavel aqui porque o Insert pode omiti-lo.
           */
          slug: string | null;
          nome_contato: string | null;
          email_contato: string | null;
          telefone: string | null;
          drive_folder_id: string | null;
          segmento: string | null;
          responsavel_atendimento_id: string | null;
          observacoes: string | null;
          /**
           * A foto de perfil da empresa no portal (0031, desenhada desde a
           * 0063). Continua editável pelo cliente, ao contrário da capa: o
           * logo é a marca dele.
           */
          logo_url: string | null;
          /**
           * A capa do portal daquele cliente (0063). Caminho no bucket
           * `campanhas-arquivos`, com o id do cliente na frente. **Só a
           * agência escreve** — `protect_client_columns` devolve o valor
           * antigo para o cliente.
           */
          capa_url: string | null;
          /**
           * Esta conta abre pedido pelo Portal? (0068)
           *
           * Default TRUE — o contrário faria o módulo nascer invisível para
           * todo cliente e a agência concluir que ele não funciona. Desligar é
           * ato de alguém, conta por conta, e serve para quem combinou que
           * tudo passa pelo Atendimento por telefone.
           */
          aceita_solicitacoes: boolean;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome_empresa: string;
          /** Omita e o gatilho gera a partir do nome. */
          slug?: string | null;
          nome_contato?: string | null;
          email_contato?: string | null;
          telefone?: string | null;
          drive_folder_id?: string | null;
          segmento?: string | null;
          responsavel_atendimento_id?: string | null;
          observacoes?: string | null;
          logo_url?: string | null;
          capa_url?: string | null;
          aceita_solicitacoes?: boolean;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          nome_empresa?: string;
          slug?: string | null;
          nome_contato?: string | null;
          email_contato?: string | null;
          telefone?: string | null;
          drive_folder_id?: string | null;
          segmento?: string | null;
          responsavel_atendimento_id?: string | null;
          observacoes?: string | null;
          logo_url?: string | null;
          capa_url?: string | null;
          aceita_solicitacoes?: boolean;
          ativo?: boolean;
        };
        Relationships: [];
      };

      /**
       * O que cada pessoa do cliente quer receber (migration 0031).
       *
       * Sem `user_id` no Update: a linha e' da pessoa, e a policy fecha em
       * `auth.uid()` nas quatro operacoes. Deixar a coluna editavel seria
       * oferecer no tipo um caminho que o banco recusa.
       */
      client_notification_prefs: {
        Row: {
          id: string;
          user_id: string;
          novo_conteudo: boolean;
          novo_comentario: boolean;
          lembrete_pendencias: boolean;
          frequencia: "imediato" | "diario" | "nunca";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          novo_conteudo?: boolean;
          novo_comentario?: boolean;
          lembrete_pendencias?: boolean;
          frequencia?: "imediato" | "diario" | "nunca";
        };
        Update: {
          novo_conteudo?: boolean;
          novo_comentario?: boolean;
          lembrete_pendencias?: boolean;
          frequencia?: "imediato" | "diario" | "nunca";
        };
        Relationships: [];
      };

      /**
       * Quem entrou no portal, quando, e o que abriu (migration 0031).
       *
       * SEM Update e SEM Delete, como `client_portal_views`: registro que o
       * proprio registrado reescreve nao e' registro. O banco tambem nao cria
       * policy para nenhum dos dois.
       */
      client_access_log: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          acao: "login" | "visualizou_item" | "download";
          entity_type: string | null;
          entity_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          acao: "login" | "visualizou_item" | "download";
          entity_type?: string | null;
          entity_id?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      /**
       * Quem da equipe abriu o portal de qual cliente. Sem Update alem de
       * encerrar, e sem Delete: registro de auditoria nao se apaga pela
       * aplicacao (migration 0009 nao cria policy de DELETE).
       */
      /**
       * Os padroes de fluxo de UM cliente (migration 0064).
       *
       * Uma linha por cliente (`client_id` e unico). **O atendimento da conta
       * e o texto de particularidades NAO moram aqui** — sao
       * `clients.responsavel_atendimento_id` e `clients.observacoes`, que ja
       * existiam: uma segunda coluna com o mesmo papel divergiria em silencio
       * da que o aviso do Portal usa.
       *
       * `updated_at` fica fora de `Insert` e de `Update`: quem escreve e o
       * trigger `client_flow_defaults_touch`.
       */
      client_flow_defaults: {
        Row: {
          id: string;
          client_id: string;
          aprovador_interno_id: string | null;
          pasta_entrega_url: string | null;
          prazo_aprovacao_cliente_dias: number;
          /**
           * O fluxo de social que os meses desta conta usam por padrão
           * (migration 0087).
           *
           * **Ele substituiu `social_aprovacoes`**, que era um `text[]` com os
           * nomes dos elos que esta conta aprovava (0076). A coluna foi
           * APAGADA e não aposentada ao lado — duas listas dizendo quais
           * etapas vão ao cliente seriam duas verdades, e no dia em que uma
           * divergisse o portal mostraria um portão que a corrente não tem.
           *
           * Nulo vale o padrão da casa, e o MÊS pode escolher outro: a ordem é
           * mês → conta → casa, que é a de `coalesce(etapa, padrão)` (0041).
           */
          social_flow_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          aprovador_interno_id?: string | null;
          pasta_entrega_url?: string | null;
          prazo_aprovacao_cliente_dias?: number;
          social_flow_id?: string | null;
        };
        Update: {
          aprovador_interno_id?: string | null;
          pasta_entrega_url?: string | null;
          prazo_aprovacao_cliente_dias?: number;
          social_flow_id?: string | null;
        };
        Relationships: [];
      };
      /**
       * Quem exerce cada funcao nesta conta (migration 0064).
       *
       * E o que faz um workflow GLOBAL com etapa apontando para "Redator"
       * servir todos os clientes. `unique (client_id, funcao)` e o que da UMA
       * resposta a "quem e o Redator da Mundo Verde?".
       *
       * **Sem Update**: trocar a pessoa de uma funcao e um upsert pela chave
       * `(client_id, funcao)`, e tirar a funcao e um delete. Um Update que
       * aceitasse `funcao` deixaria renomear a chave de uma linha para uma
       * funcao que ja tem dono, e a recusa sairia do indice.
       */
      client_function_defaults: {
        Row: {
          id: string;
          client_id: string;
          funcao: TeamFuncao;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          funcao: TeamFuncao;
          user_id: string;
        };
        Update: { user_id?: string };
        Relationships: [];
      };
      /**
       * A nota fiscal da pessoa (0065).
       *
       * `status`, `motivo_recusa`, `decidido_*`, `pagamento` e
       * `finance_entry_id` ficam FORA de `Insert` e de `Update`, e é a mesma
       * decisão do cronômetro da subtarefa: quem escreve essas colunas é o
       * banco — a policy exige o sócio, o trigger carimba quem decidiu, e a
       * despesa nasce da transição. Deixá-las aqui faria a tela oferecer uma
       * escrita que o Postgres recusa, e o erro chegaria em inglês.
       *
       * Decidir passa pela action `decidirNota`, que chama o update com o
       * cliente do próprio sócio — o RLS continua valendo.
       */
      team_invoices: {
        Row: {
          id: string;
          user_id: string;
          competencia: string;
          valor: number;
          numero: string | null;
          arquivo_url: string;
          observacoes: string | null;
          status: NfStatus;
          motivo_recusa: string | null;
          decidido_por: string | null;
          decidido_em: string | null;
          pagamento: string | null;
          finance_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          competencia: string;
          valor: number;
          numero?: string | null;
          arquivo_url: string;
          observacoes?: string | null;
        };
        Update: {
          valor?: number;
          numero?: string | null;
          arquivo_url?: string;
          observacoes?: string | null;
          /** Só o sócio escreve — a policy e o trigger é que decidem. */
          status?: NfStatus;
          motivo_recusa?: string | null;
          pagamento?: string | null;
        };
        Relationships: [];
      };
      /**
       * Cada vez que o sócio pediu as notas fiscais de um mês (0066).
       *
       * **Sem `Update` e sem `Delete`, e é o desenho**: o pedido é o registro
       * de uma coisa que aconteceu — oito pessoas receberam o aviso —, e
       * apagar a linha não desfaz os avisos. A mesma forma de
       * `client_portal_views` e do `audit_log`.
       *
       * Quem escreve é `solicitar_notas_do_mes()`, não um insert da tela: o
       * registro e os N avisos são uma transação só. `quantas_pessoas` fica
       * fora do `Insert` por isso — a função é que conta.
       */
      invoice_requests: {
        Row: {
          id: string;
          competencia: string;
          solicitado_por: string;
          quantas_pessoas: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          competencia: string;
          solicitado_por: string;
        };
        Update: never;
        Relationships: [];
      };
      /**
       * Os tipos de pedido, com o roteiro de briefing (0068).
       *
       * `campos_json` é um ARRAY, e um `check` no banco garante isso: um objeto
       * gravado ali não quebra nada na hora — ele quebra na tela do cliente,
       * que faz `.map()` no que veio e mostra um formulário sem campo nenhum,
       * sem erro e sem log.
       */
      request_types: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          icone: string | null;
          campos_json: CampoDoRoteiro[];
          ordem: number;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          icone?: string | null;
          campos_json?: CampoDoRoteiro[];
          ordem?: number;
          ativo?: boolean;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          icone?: string | null;
          campos_json?: CampoDoRoteiro[];
          ordem?: number;
          ativo?: boolean;
        };
        Relationships: [];
      };
      /**
       * O pedido que o cliente abre pelo Portal (0068).
       *
       * **`status`, `criado_por`, `motivo_recusa` e `decidida_em` ficam FORA do
       * `Insert`**, e não é economia de digitação: o trigger
       * `client_requests_normaliza` reescreve os quatro quando quem escreve não
       * é da equipe, então tentar gravá-los é erro de tipo antes de ser uma
       * escrita que o banco descarta em silêncio. É a forma das duas colunas do
       * cronômetro.
       *
       * **`data_desejada` é DESEJO, nunca compromisso.** O que a agência assume
       * é `tasks.data_fim`, e a conversão não copia um no outro.
       */
      assets: {
        Row: {
          id: string;
          codigo: string | null;
          tipo: AssetTipo;
          nome: string;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          status: AssetStatus;
          estado: AssetEstado;
          data_aquisicao: string | null;
          /** So a gestao LE: `assets_select` fecha em is_gestor() (0069). */
          valor_aquisicao: number | null;
          nota_fiscal_url: string | null;
          foto_url: string | null;
          observacoes: string | null;
          motivo_baixa: string | null;
          /** A FICHA TECNICA (0070), `text` porque a unidade faz parte do que se
           *  le: "16 GB", "512 GB SSD", "Intel i7-1165G7". Vazia em tudo que
           *  nao e computador, e a TELA e quem decide mostrar. */
          memoria_ram: string | null;
          processador: string | null;
          placa_de_video: string | null;
          armazenamento: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          /** Em branco vira FCK-0000 pela sequence, no trigger. */
          codigo?: string | null;
          tipo: AssetTipo;
          nome: string;
          marca?: string | null;
          modelo?: string | null;
          numero_serie?: string | null;
          estado?: AssetEstado;
          data_aquisicao?: string | null;
          valor_aquisicao?: number | null;
          nota_fiscal_url?: string | null;
          foto_url?: string | null;
          observacoes?: string | null;
          memoria_ram?: string | null;
          processador?: string | null;
          placa_de_video?: string | null;
          armazenamento?: string | null;
          criado_por?: string | null;
        };
        Update: {
          codigo?: string | null;
          tipo?: AssetTipo;
          nome?: string;
          marca?: string | null;
          modelo?: string | null;
          numero_serie?: string | null;
          /** `emprestado` nao se escreve a mao: quem o poe la e o emprestimo. */
          status?: AssetStatus;
          estado?: AssetEstado;
          data_aquisicao?: string | null;
          valor_aquisicao?: number | null;
          nota_fiscal_url?: string | null;
          foto_url?: string | null;
          observacoes?: string | null;
          motivo_baixa?: string | null;
          memoria_ram?: string | null;
          processador?: string | null;
          placa_de_video?: string | null;
          armazenamento?: string | null;
        };
        Relationships: [];
      };
      asset_loans: {
        Row: {
          id: string;
          asset_id: string;
          user_id: string;
          data_entrega: string;
          data_prevista_devolucao: string | null;
          data_devolucao: string | null;
          estado_entrega: AssetEstado;
          estado_devolucao: AssetEstado | null;
          acessorios: string | null;
          observacoes_entrega: string | null;
          observacoes_devolucao: string | null;
          termo_corpo: string | null;
          aceito_em: string | null;
          entregue_por: string;
          recebido_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          user_id: string;
          data_entrega?: string;
          data_prevista_devolucao?: string | null;
          estado_entrega?: AssetEstado;
          acessorios?: string | null;
          observacoes_entrega?: string | null;
          entregue_por: string;
        };
        Update: {
          /** A devolucao, e so ela. O par data + estado e cobrado por check. */
          data_devolucao?: string | null;
          estado_devolucao?: AssetEstado | null;
          observacoes_devolucao?: string | null;
          recebido_por?: string | null;
          data_prevista_devolucao?: string | null;
          acessorios?: string | null;
          observacoes_entrega?: string | null;
        };
        /**
         * `aceito_em` e `termo_corpo` ficam FORA de Insert e de Update de
         * proposito, como o cronometro da subtarefa: o aceite so entra por
         * `confirmar_recebimento()` e o termo e congelado pelo trigger.
         * Tentar grava-los e erro de tipo antes de ser recusa do banco.
         */
        Relationships: [];
      };
      asset_photos: {
        Row: {
          id: string;
          loan_id: string;
          momento: "entrega" | "devolucao";
          url: string;
          created_at: string;
        };
        Insert: {
          loan_id: string;
          momento: "entrega" | "devolucao";
          url: string;
        };
        Update: never;
        Relationships: [];
      };
      asset_events: {
        Row: {
          id: string;
          asset_id: string;
          loan_id: string | null;
          tipo: AssetEventoTipo;
          texto: string | null;
          estado: AssetEstado | null;
          pessoa_id: string | null;
          registrado_por: string | null;
          created_at: string;
        };
        /** Sem Insert e sem Update: a unica porta sao os triggers (0069). */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      asset_term_template: {
        Row: {
          id: string;
          unica: boolean;
          corpo: string;
          atualizado_por: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          corpo?: string;
          atualizado_por?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_requests: {
        Row: {
          id: string;
          client_id: string;
          request_type_id: string | null;
          criado_por: string | null;
          titulo: string;
          descricao: string | null;
          respostas: Record<string, string>;
          data_desejada: string | null;
          status: SolicitacaoStatus;
          motivo_recusa: string | null;
          decidida_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          request_type_id?: string | null;
          titulo: string;
          descricao?: string | null;
          respostas?: Record<string, string>;
          data_desejada?: string | null;
        };
        Update: {
          /** Só `is_atendimento()` — a policy de UPDATE não aceita o cliente. */
          status?: SolicitacaoStatus;
          motivo_recusa?: string | null;
          titulo?: string;
          descricao?: string | null;
          request_type_id?: string | null;
        };
        Relationships: [];
      };
      /**
       * Os anexos do pedido, no bucket privado `solicitacoes-arquivos` (0068).
       *
       * **Sem `Update`, e a tabela também não tem policy de UPDATE**: trocar o
       * arquivo por baixo de um nome que alguém já leu é trocar o destino
       * embaixo de quem o leu. Apaga e põe outro — a decisão de
       * `post_referencias`.
       */
      request_attachments: {
        Row: {
          id: string;
          request_id: string;
          caminho: string;
          nome: string;
          tipo: string | null;
          tamanho: number | null;
          enviado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          caminho: string;
          nome: string;
          tipo?: string | null;
          tamanho?: number | null;
          enviado_por?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      /**
       * A conversa do pedido (0068).
       *
       * **Não existe `interno` aqui, e a ausência é a regra do módulo**: tudo o
       * que se escreve é para o cliente ler. Quem precisa falar da agência para
       * dentro fala em `task_comentarios`, na demanda.
       *
       * Sem `Update`: mensagem não se edita nem se apaga, nem pelo sócio. Ela é
       * o combinado entre duas empresas sobre o que vai ser feito, não uma
       * opinião — a razão pela qual rodada de aprovação fechada nunca é
       * reescrita. E `autor_id` fica fora do `Insert` porque o trigger o
       * reescreve: policy não limita coluna.
       */
      request_messages: {
        Row: {
          id: string;
          request_id: string;
          autor_id: string;
          texto: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          texto: string;
        };
        Update: never;
        Relationships: [];
      };
      client_portal_views: {
        Row: {
          id: string;
          client_id: string;
          staff_user_id: string;
          iniciado_em: string;
          encerrado_em: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          staff_user_id: string;
          iniciado_em?: string;
          encerrado_em?: string | null;
        };
        Update: { encerrado_em?: string | null };
        Relationships: [];
      };
      /**
       * Avisos in-app (migration 0011).
       *
       * SEM Insert: nao existe policy de insert, e a unica porta e a funcao
       * `notificar()` no Postgres. O Update aceita so `lida_em` -- um trigger
       * recusa qualquer outra coluna.
       */
      notifications: {
        Row: {
          id: string;
          user_id: string;
          tipo: NotificationTipo;
          titulo: string;
          corpo: string | null;
          link: string | null;
          origem_id: string | null;
          lida_em: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { lida_em?: string | null };
        Relationships: [];
      };
      /** Pedidos de ferias, licenca e ausencia (migration 0011). */
      /** Uma regra de demanda recorrente (migration 0040). */
      task_recurrences: {
        Row: {
          id: string;
          client_id: string;
          nome: string;
          modo: RecorrenciaModo;
          frequencia: RecorrenciaFrequencia;
          dias_semana: number[] | null;
          dia_mes: number | null;
          pular_feriados: boolean;
          data_inicio: string;
          data_fim: string | null;
          antecedencia_dias: number;
          gerar_como_rascunho: boolean;
          modelo: Json;
          task_type_id: string | null;
          ativo: boolean;
          ultima_geracao_em: string | null;
          // Escrita pelo trigger `task_recurrences_recalcula` a cada mudanca
          // no QUANDO da regra. Fica fora de Insert e de Update: uma data
          // gravada a mao seria desfeita pelo trigger no mesmo instante.
          proxima_geracao_em: string | null;
          criado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nome: string;
          modo?: RecorrenciaModo;
          frequencia?: RecorrenciaFrequencia;
          dias_semana?: number[] | null;
          dia_mes?: number | null;
          pular_feriados?: boolean;
          data_inicio: string;
          data_fim?: string | null;
          antecedencia_dias?: number;
          gerar_como_rascunho?: boolean;
          modelo: Json;
          task_type_id?: string | null;
          ativo?: boolean;
          criado_por: string;
        };
        Update: {
          nome?: string;
          modo?: RecorrenciaModo;
          frequencia?: RecorrenciaFrequencia;
          dias_semana?: number[] | null;
          dia_mes?: number | null;
          pular_feriados?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          antecedencia_dias?: number;
          gerar_como_rascunho?: boolean;
          modelo?: Json;
          task_type_id?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };
      /**
       * Uma linha por ocorrencia tentada. NAO TEM Insert nem Update: a unica
       * porta e `gerar_ocorrencia()`, como `notifications` so se escreve por
       * `notificar()`. Sem isso daria para forjar uma chave de ocorrencia e,
       * com ela, impedir para sempre que aquele mes fosse gerado.
       */
      recurrence_runs: {
        Row: {
          id: string;
          recurrence_id: string;
          chave_ocorrencia: string;
          task_id: string | null;
          status: "gerada" | "pulada" | "erro";
          detalhes: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      hr_requests: {
        Row: {
          id: string;
          user_id: string;
          tipo: HrTipo;
          data_inicio: string;
          data_fim: string;
          // CORRIDOS quando o tipo é descanso (`ferias`), dias úteis nos
          // outros dois — que não descontam saldo (migration 0024). O nome
          // ficou de antes, como `dias_ferias_ano`.
          dias_uteis: number;
          motivo: string | null;
          status: HrStatus;
          motivo_reprovacao: string | null;
          aprovado_por: string | null;
          decidido_em: string | null;
          origem: HrOrigem;
          lancado_por: string | null;
          lancado_em: string | null;
          created_at: string;
        };
        // `origem` FICA DE FORA do Insert, e não é esquecimento: gravar
        // qualquer coisa diferente de `solicitacao` é o lançamento
        // retroativo, e ele passa por `lancar_periodo()`, que confere
        // `is_gestor()` e preenche `lancado_por` sozinha. Deixá-la aqui
        // convidaria a montar o insert à mão — a policy recusaria, mas só na
        // hora de rodar, e o erro sairia como "nenhuma linha voltou".
        Insert: {
          id?: string;
          user_id: string;
          tipo: HrTipo;
          data_inicio: string;
          data_fim: string;
          dias_uteis: number;
          motivo?: string | null;
        };
        // Decidir e cancelar passam pelas funcoes do banco, nao por update.
        // O update direto e so do dono e so enquanto pendente. Corrigir um
        // lancamento passa por `corrigir_lancamento()`, pelo mesmo motivo.
        Update: {
          tipo?: HrTipo;
          data_inicio?: string;
          data_fim?: string;
          dias_uteis?: number;
          motivo?: string | null;
        };
        Relationships: [];
      };
      /** Um dia de uma pessoa na matriz da equipe (migration 0011). */
      team_presence: {
        Row: {
          id: string;
          user_id: string;
          data: string;
          status: PresencaStatus;
          observacao: string | null;
          hr_request_id: string | null;
          atualizado_por: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data: string;
          status?: PresencaStatus;
          observacao?: string | null;
          hr_request_id?: string | null;
          atualizado_por?: string | null;
        };
        Update: {
          status?: PresencaStatus;
          observacao?: string | null;
          atualizado_por?: string | null;
        };
        Relationships: [];
      };
      holidays: {
        Row: { id: string; data: string; nome: string };
        Insert: { id?: string; data: string; nome: string };
        Update: { data?: string; nome?: string };
        Relationships: [];
      };
      /**
       * Catalogo compartilhado de skills (migration 0012).
       *
       * SEM `sugerida_por`, e a ausencia era drift: a 0043 apagou a coluna
       * junto com a tela que decidia as sugestoes -- o catalogo tinha dois
       * caminhos de entrada, a gestao criava e a equipe sugeria, e a fila de
       * aprovacao morava no modulo que saiu. Aqui ela ficou declarada por
       * quatro migrations, no Row, no Insert e no Update: compilava,
       * autocompletava, e qualquer escrita levaria *"Could not find the
       * 'sugerida_por' column"* na tela de quem usa o sistema.
       *
       * `ativa` FICA: e como a gestao tira do ar uma etiqueta que a agencia nao
       * usa mais sem apagar a que ja esta em material antigo.
       */
      skills: {
        Row: {
          id: string;
          nome: string;
          categoria: string | null;
          descricao: string | null;
          ativa: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          categoria?: string | null;
          descricao?: string | null;
          ativa?: boolean;
        };
        Update: {
          nome?: string;
          categoria?: string | null;
          descricao?: string | null;
          ativa?: boolean;
        };
        Relationships: [];
      };
      /**
       * O CATALOGO FICOU, e o que saiu na 0043 foram as duas tabelas que
       * moravam aqui: a autoavaliacao de cada pessoa e a observacao da
       * gestao. `skills` continua, agora como vocabulario de etiquetas do
       * Full Academy -- decisao do usuario.
       */
      contracts: {
        Row: {
          id: string;
          client_id: string;
          nome: string;
          valor: number;
          recorrencia: ContratoRecorrencia;
          dia_vencimento: number | null;
          data_inicio: string;
          data_fim: string | null;
          ativo: boolean;
          observacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nome: string;
          valor: number;
          recorrencia?: ContratoRecorrencia;
          dia_vencimento?: number | null;
          data_inicio: string;
          data_fim?: string | null;
          ativo?: boolean;
          observacoes?: string | null;
        };
        Update: {
          client_id?: string;
          nome?: string;
          valor?: number;
          recorrencia?: ContratoRecorrencia;
          dia_vencimento?: number | null;
          data_inicio?: string;
          data_fim?: string | null;
          ativo?: boolean;
          observacoes?: string | null;
        };
        Relationships: [];
      };
      finance_categories: {
        Row: { id: string; nome: string; tipo: FinTipo };
        Insert: { id?: string; nome: string; tipo: FinTipo };
        Update: { nome?: string; tipo?: FinTipo };
        Relationships: [];
      };
      finance_entries: {
        Row: {
          id: string;
          tipo: FinTipo;
          client_id: string | null;
          contract_id: string | null;
          category_id: string | null;
          descricao: string;
          valor: number;
          competencia: string;
          vencimento: string | null;
          pagamento: string | null;
          status: FinStatus;
          fornecedor: string | null;
          observacoes: string | null;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: FinTipo;
          client_id?: string | null;
          contract_id?: string | null;
          category_id?: string | null;
          descricao: string;
          valor: number;
          competencia: string;
          vencimento?: string | null;
          pagamento?: string | null;
          status?: FinStatus;
          fornecedor?: string | null;
          observacoes?: string | null;
          criado_por: string;
        };
        Update: {
          tipo?: FinTipo;
          client_id?: string | null;
          contract_id?: string | null;
          category_id?: string | null;
          descricao?: string;
          valor?: number;
          competencia?: string;
          vencimento?: string | null;
          pagamento?: string | null;
          status?: FinStatus;
          fornecedor?: string | null;
          observacoes?: string | null;
        };
        Relationships: [];
      };
      client_users: {
        Row: { id: string; client_id: string; user_id: string; created_at: string };
        Insert: { id?: string; client_id: string; user_id: string; created_at?: string };
        Update: { client_id?: string; user_id?: string };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          user_id: string;
          cargo: string | null;
          area: string | null;
          funcao: TeamFuncao | null;
          data_admissao: string | null;
          dias_ferias_ano: number;
          max_parcelas_ferias: number;
          ativo: boolean;
          desligado_em: string | null;
          created_at: string;
          // 0055: minutos de trabalho por dia útil desta pessoa. 480 = 8h.
          capacidade_minutos_dia: number;
          /**
           * Se esta pessoa quer receber o feedback de desenvolvimento (0075).
           *
           * Fica FORA de `Insert` e de `Update`, e a ausência é a regra:
           * `team_members` é `is_gestor()` no UPDATE desde o Sprint 2, então
           * quem altera isto é a própria pessoa, por
           * `escolher_receber_feedback()`. Uma policy de UPDATE para ela daria
           * junto a capacidade diária, o saldo de descanso e a função —
           * policy não limita coluna.
           */
          recebe_feedback_ia: boolean;
          /** Quando esta pessoa leu a explicação do feedback (0075). Nulo = ainda não leu. */
          feedback_explicado_em: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          cargo?: string | null;
          area?: string | null;
          funcao?: TeamFuncao | null;
          data_admissao?: string | null;
          dias_ferias_ano?: number;
          max_parcelas_ferias?: number;
          ativo?: boolean;
          desligado_em?: string | null;
          created_at?: string;
          capacidade_minutos_dia?: number;
        };
        Update: {
          cargo?: string | null;
          area?: string | null;
          funcao?: TeamFuncao | null;
          data_admissao?: string | null;
          dias_ferias_ano?: number;
          max_parcelas_ferias?: number;
          ativo?: boolean;
          desligado_em?: string | null;
          capacidade_minutos_dia?: number;
        };
        Relationships: [];
      };
      /**
       * O FEEDBACK DE DESENVOLVIMENTO (0075).
       *
       * `metricas_json` e `contexto_json` viajam na mesma linha do texto de
       * propósito: a tela da pessoa mostra os dois juntos, porque texto sem
       * número é opinião de máquina e ela não teria como conferir se a IA leu
       * certo.
       *
       * `texto_gerado` e `texto_final` são DUAS colunas, e juntá-las
       * destruiria a única coisa que permite auditar a revisão: o que a IA
       * escreveu. Com uma só, editar apagaria a saída do modelo.
       */
      feedback_reports: {
        Row: {
          id: string;
          user_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          periodicidade: FeedbackPeriodicidade;
          metricas_json: Json;
          contexto_json: Json;
          texto_gerado: string | null;
          texto_final: string | null;
          modelo_usado: string | null;
          prompt_versao: string | null;
          /** O que a verificação pós-geração achou no texto. Sinaliza, nunca descarta em silêncio. */
          alertas_json: Json;
          status: FeedbackStatus;
          revisado_por: string | null;
          revisado_em: string | null;
          enviado_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          periodicidade?: FeedbackPeriodicidade;
          metricas_json: Json;
          contexto_json: Json;
          texto_gerado?: string | null;
          texto_final?: string | null;
          modelo_usado?: string | null;
          prompt_versao?: string | null;
          alertas_json?: Json;
          status?: FeedbackStatus;
        };
        Update: {
          metricas_json?: Json;
          contexto_json?: Json;
          texto_gerado?: string | null;
          texto_final?: string | null;
          modelo_usado?: string | null;
          prompt_versao?: string | null;
          alertas_json?: Json;
          status?: FeedbackStatus;
          revisado_por?: string | null;
          revisado_em?: string | null;
          enviado_em?: string | null;
        };
        Relationships: [];
      };
      /**
       * A resposta ao feedback, e a conversa que segue (0075).
       *
       * Sem `Update`: a tabela não tem policy de UPDATE nem de DELETE, nem
       * para o sócio. A resposta é o registro de que a pessoa discordou, e
       * reescrevê-la depois apagaria a discordância — a razão pela qual rodada
       * de aprovação fechada nunca é reescrita.
       */
      feedback_replies: {
        Row: {
          id: string;
          report_id: string;
          autor_id: string;
          texto: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          autor_id: string;
          texto: string;
        };
        // `never` e não a ausência da chave: o tipo `Database` do supabase-js
        // exige as três, e sem uma delas o schema inteiro degrada para `never`
        // — o mesmo laço que `audit_log` já documenta acima.
        Update: never;
        Relationships: [];
      };
      /**
       * Os sinais que são da GESTÃO e não da pessoa (0075).
       *
       * Sem `Insert`: quem escreve é `registrar_alertas_de_carga()`, e um
       * alerta montado à mão diria que a agência mediu uma coisa que ninguém
       * mediu. Sem `delete` no banco: o caminho é marcar resolvido.
       */
      workload_alerts: {
        Row: {
          id: string;
          user_id: string;
          periodo_inicio: string;
          periodo_fim: string;
          tipo:
            | "sobrecarga"
            | "ociosidade"
            | "gargalo_aprovacao"
            | "retrabalho_por_cliente";
          detalhes: Json;
          resolvido: boolean;
          created_at: string;
        };
        // `never` e não a ausência da chave, como em `audit_log`: sem as três,
        // o schema inteiro degrada.
        Insert: never;
        Update: {
          resolvido?: boolean;
        };
        Relationships: [];
      };
      /**
       * Como o feedback é gerado (0075). Uma linha só, e nasce nesta
       * migration — por isso sem `Insert`.
       *
       * `exige_revisao` nasce `true`, e é o default mais importante do módulo.
       */
      feedback_config: {
        Row: {
          id: string;
          unica: boolean;
          periodicidade: FeedbackPeriodicidade;
          revisor_id: string | null;
          exige_revisao: boolean;
          minimo_subtarefas: number;
          atualizado_por: string | null;
          updated_at: string;
        };
        // `never` e não a ausência da chave, como em `audit_log`.
        Insert: never;
        Update: {
          periodicidade?: FeedbackPeriodicidade;
          revisor_id?: string | null;
          exige_revisao?: boolean;
          minimo_subtarefas?: number;
          atualizado_por?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      academy_tracks: {
        Row: {
          id: string;
          titulo: string;
          descricao: string | null;
          area: string | null;
          capa_url: string | null;
          obrigatoria: boolean;
          publicada: boolean;
          ordem: number;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          descricao?: string | null;
          area?: string | null;
          capa_url?: string | null;
          obrigatoria?: boolean;
          publicada?: boolean;
          ordem?: number;
          criado_por: string;
        };
        Update: {
          titulo?: string;
          descricao?: string | null;
          area?: string | null;
          capa_url?: string | null;
          obrigatoria?: boolean;
          publicada?: boolean;
          ordem?: number;
        };
        Relationships: [];
      };
      /**
       * A TRILHA DE AUDITORIA (0058).
       *
       * Só `Row`. Não existe `Insert` nem `Update` de propósito, e é a mesma
       * decisão de `tempo_medido_segundos` ficar fora dos dois em `subtasks`:
       * quem escreve aqui é o trigger `registrar_auditoria()`, e a tabela não
       * tem policy de insert, de update nem de delete. Tentar gravar pelo
       * cliente tipado vira erro de tipo antes de virar recusa do banco.
       */
      audit_log: {
        Row: {
          id: string;
          tabela: string;
          registro_id: string | null;
          operacao: "INSERT" | "UPDATE" | "DELETE";
          quem: string | null;
          quando: string;
          antes: Record<string, unknown> | null;
          depois: Record<string, unknown> | null;
        };
        // `never` NOS DOIS, e não a ausência das chaves: o tipo `Database` do
        // supabase-js exige as três, e sem elas o schema inteiro degrada — o
        // `tsc` passou a acusar `nome_empresa does not exist on type never`
        // em `weekly.ts`, três arquivos longe daqui. Com `never`, qualquer
        // `.insert()` ou `.update()` nesta tabela é erro de tipo, que é o que
        // se queria: quem escreve é o trigger.
        Insert: never;
        Update: never;
        Relationships: [];
      };

      academy_materials: {
        Row: {
          id: string;
          track_id: string;
          titulo: string;
          descricao: string | null;
          tipo: MaterialTipo;
          url: string | null;
          arquivo_url: string | null;
          duracao_minutos: number | null;
          ordem: number;
          skill_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          track_id: string;
          titulo: string;
          descricao?: string | null;
          tipo: MaterialTipo;
          url?: string | null;
          arquivo_url?: string | null;
          duracao_minutos?: number | null;
          ordem?: number;
          skill_id?: string | null;
        };
        Update: {
          titulo?: string;
          descricao?: string | null;
          tipo?: MaterialTipo;
          url?: string | null;
          arquivo_url?: string | null;
          duracao_minutos?: number | null;
          ordem?: number;
          skill_id?: string | null;
        };
        Relationships: [];
      };
      academy_progress: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          concluido: boolean;
          concluido_em: string | null;
          anotacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          concluido?: boolean;
          anotacoes?: string | null;
        };
        Update: {
          concluido?: boolean;
          anotacoes?: string | null;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          autor_id: string;
          categoria: RecCategoria;
          titulo: string;
          descricao: string | null;
          url: string | null;
          imagem_url: string | null;
          tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          autor_id: string;
          categoria: RecCategoria;
          titulo: string;
          descricao?: string | null;
          url?: string | null;
          imagem_url?: string | null;
          tags?: string[] | null;
        };
        Update: {
          categoria?: RecCategoria;
          titulo?: string;
          descricao?: string | null;
          url?: string | null;
          imagem_url?: string | null;
          tags?: string[] | null;
        };
        Relationships: [];
      };
      recommendation_likes: {
        Row: {
          id: string;
          recommendation_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: { id?: string; recommendation_id: string; user_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      recommendation_comments: {
        Row: {
          id: string;
          recommendation_id: string;
          autor_id: string;
          texto: string;
          resposta_a: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recommendation_id: string;
          autor_id: string;
          texto: string;
          resposta_a?: string | null;
        };
        Update: { texto?: string };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          // NULO enquanto é rascunho (migration 0028): a pessoa escolhe o
          // cliente na própria tela. A exigência passou para a publicação.
          client_id: string | null;
          titulo: string;
          briefing_rico: Json | null;
          briefing_texto: string | null;
          prioridade: TaskPrioridade;
          status: TaskStatus;
          status_manual: boolean;
          data_inicio: string;
          data_fim: string | null;
          task_type_id: string | null;
          workflow_snapshot: Json | null;
          link_entrega: string | null;
          // De qual regra recorrente esta task saiu (migration 0040). Fica
          // FORA de Insert e de Update: quem preenche é `gerar_ocorrencia()`,
          // e uma task marcada à mão como recorrente mentiria sobre a origem
          // dela no selo que a tela mostra.
          recurrence_id: string | null;
          // O mês de social que esta demanda agrupa, sempre no dia 1
          // (migration 0061). Nulo = demanda comum. Fica FORA de Insert e de
          // Update pela mesma razão de `recurrence_id`: quem a preenche é
          // `abrir_mes_de_social()`, e uma demanda marcada à mão como o social
          // de um mês mentiria no selo que a tela mostra.
          social_do_mes: string | null;
          /**
           * O FLUXO que o mês de social desta demanda percorre (0087).
           *
           * Preenchido só em demanda de mês, e é ele que faz abrir o mesmo mês
           * em duas vezes usar a MESMA corrente: sem ele a segunda chamada
           * poderia usar outro fluxo, e o mês ficaria com metade dos posts
           * indo ao cliente por um caminho e metade por outro.
           *
           * Fica FORA de Insert e de Update pela razão de `social_do_mes`:
           * quem o preenche é `abrir_mes_de_social()`, e uma demanda comum
           * apontando para um fluxo de social não quer dizer nada.
           */
          social_flow_id: string | null;
          /**
           * O pedido do cliente que virou esta demanda (0068).
           *
           * **Está no `Insert` e NÃO no `Update`**, e a assimetria é a regra do
           * sprint: a ligação nasce com o rascunho, no clique de converter, e
           * não se muda depois. Apontar uma demanda existente para outro pedido
           * faria o cliente ver, no portal dele, o andamento de um trabalho que
           * não é o que ele pediu — e o índice único já garante que um pedido
           * vira uma demanda só.
           */
          request_id: string | null;
          criado_por: string;
          concluida_em: string | null;
          // NULO = rascunho (migration 0028). Só quem criou enxerga, e nada
          // dela conta em lista, contador, notificação ou portal.
          publicada_em: string | null;
          arquivada_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          titulo: string;
          // Omitido, a demanda nasce PUBLICADA (o default do banco é now()).
          // Rascunho se pede explicitamente, com null.
          publicada_em?: string | null;
          arquivada_em?: string | null;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          status_manual?: boolean;
          data_inicio?: string;
          data_fim?: string | null;
          task_type_id?: string | null;
          workflow_snapshot?: Json | null;
          link_entrega?: string | null;
          request_id?: string | null;
          criado_por: string;
        };
        Update: {
          titulo?: string;
          client_id?: string | null;
          publicada_em?: string | null;
          arquivada_em?: string | null;
          briefing_rico?: Json | null;
          briefing_texto?: string | null;
          prioridade?: TaskPrioridade;
          status?: TaskStatus;
          status_manual?: boolean;
          // `data_inicio` e `data_fim` ficam FORA do Update: desde a 0028 o
          // período da Task é derivado das etapas, escrito por trigger.
          // Tentar gravá-los é erro de tipo aqui, antes de virar duas
          // verdades sobre a mesma demanda.
          task_type_id?: string | null;
          workflow_snapshot?: Json | null;
          link_entrega?: string | null;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          // A etapa de cima (migration 0022). Null = etapa da Task; preenchido
          // = sub-etapa. Nunca um terceiro nível: o trigger recusa o neto.
          parent_id: string | null;
          titulo: string;
          descricao_rica: Json | null;
          descricao_texto: string | null;
          // Aviso escrito pela geração automática (migration 0040):
          // responsável fora na data, responsável desligado. Só a geração
          // escreve; a tela mostra e a pessoa resolve.
          aviso_geracao: string | null;
          // O PERÍODO da etapa (migration 0027). O fim continua se chamando
          // `prazo`: é ele que define atraso, e o nome já diz que é a ponta
          // final. Os dois são opcionais — etapa sem data é caso normal.
          data_inicio: string | null;
          prazo: string | null;
          responsavel_id: string | null;
          prioridade: TaskPrioridade;
          status: SubtaskStatus;
          requer_aprovacao: boolean;
          tipo_aprovacao: TipoAprovacao | null;
          estimativa_minutos: number | null;
          tempo_real_minutos: number | null;
          ordem: number;
          iniciada_em: string | null;
          concluida_em: string | null;
          // O cronômetro (migration 0021). Só o trigger escreve, e por isso
          // as duas ficam FORA de Insert e de Update: assim tentar gravá-las
          // é erro de tipo aqui, muito antes de o banco descartar o valor.
          andando_desde: string | null;
          tempo_medido_segundos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          parent_id?: string | null;
          titulo: string;
          descricao_rica?: Json | null;
          descricao_texto?: string | null;
          data_inicio?: string | null;
          prazo?: string | null;
          responsavel_id?: string | null;
          prioridade?: TaskPrioridade;
          status?: SubtaskStatus;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          estimativa_minutos?: number | null;
          tempo_real_minutos?: number | null;
          ordem?: number;
        };
        Update: {
          parent_id?: string | null;
          titulo?: string;
          descricao_rica?: Json | null;
          descricao_texto?: string | null;
          data_inicio?: string | null;
          prazo?: string | null;
          responsavel_id?: string | null;
          prioridade?: TaskPrioridade;
          status?: SubtaskStatus;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          estimativa_minutos?: number | null;
          tempo_real_minutos?: number | null;
          ordem?: number;
        };
        Relationships: [];
      };
      subtask_dependencies: {
        Row: {
          id: string;
          subtask_id: string;
          depende_de_id: string;
          created_at: string;
        };
        Insert: { id?: string; subtask_id: string; depende_de_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      approval_rounds: {
        Row: {
          id: string;
          /** subtask | post | deliverable (migration 0030). */
          content_type: TipoDeConteudo;
          /** O id na tabela que `content_type` nomeia. Sem chave estrangeira. */
          content_id: string;
          numero_rodada: number;
          escopo: EscopoRodada;
          status: StatusRodada;
          solicitado_por: string;
          solicitado_em: string;
          decidido_por: string | null;
          decidido_em: string | null;
          comentario: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          // OBRIGATORIO no tipo, embora o banco tenha default 'subtask'. O
          // default existe para a migration converter as linhas antigas; o
          // codigo novo diz de que conteudo esta falando, senao a
          // generalizacao vira uma coluna que ninguem preenche.
          content_type: TipoDeConteudo;
          content_id: string;
          numero_rodada: number;
          escopo: EscopoRodada;
          status?: StatusRodada;
          solicitado_por: string;
          comentario?: string | null;
        };
        Update: {
          status?: StatusRodada;
          decidido_por?: string | null;
          decidido_em?: string | null;
          comentario?: string | null;
        };
        Relationships: [];
      };
      subtask_entregas: {
        Row: {
          id: string;
          subtask_id: string;
          approval_round_id: string | null;
          tipo: "arquivo" | "link";
          url: string;
          nome: string | null;
          enviado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          subtask_id: string;
          approval_round_id?: string | null;
          tipo: "arquivo" | "link";
          url: string;
          nome?: string | null;
          enviado_por: string;
        };
        Update: { approval_round_id?: string | null; nome?: string | null };
        Relationships: [];
      };
      task_history: {
        Row: {
          id: string;
          task_id: string;
          subtask_id: string | null;
          approval_round_id: string | null;
          acao: string;
          de_valor: string | null;
          para_valor: string | null;
          autor_id: string | null;
          detalhes: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          subtask_id?: string | null;
          approval_round_id?: string | null;
          acao: string;
          de_valor?: string | null;
          para_valor?: string | null;
          autor_id?: string | null;
          detalhes?: Json | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      task_types: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          client_id: string | null;
          workflow_template_id: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          client_id?: string | null;
          workflow_template_id?: string | null;
          ativo?: boolean;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          client_id?: string | null;
          workflow_template_id?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };
      workflow_templates: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          client_id: string | null;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          client_id?: string | null;
          ativo?: boolean;
          criado_por?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          client_id?: string | null;
          ativo?: boolean;
        };
        Relationships: [];
      };
      workflow_steps: {
        Row: {
          id: string;
          template_id: string;
          nome: string;
          ordem: number;
          responsavel_padrao_id: string | null;
          funcao_padrao: TeamFuncao | null;
          prioridade: TaskPrioridade;
          prazo_offset_dias: number | null;
          requer_aprovacao: boolean;
          tipo_aprovacao: TipoAprovacao | null;
          depende_de_ordem: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          nome: string;
          ordem: number;
          responsavel_padrao_id?: string | null;
          funcao_padrao?: TeamFuncao | null;
          prioridade?: TaskPrioridade;
          prazo_offset_dias?: number | null;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          depende_de_ordem?: number | null;
        };
        Update: {
          nome?: string;
          ordem?: number;
          responsavel_padrao_id?: string | null;
          funcao_padrao?: TeamFuncao | null;
          prioridade?: TaskPrioridade;
          prazo_offset_dias?: number | null;
          requer_aprovacao?: boolean;
          tipo_aprovacao?: TipoAprovacao | null;
          depende_de_ordem?: number | null;
        };
        Relationships: [];
      };
      task_referencias: {
        Row: {
          id: string;
          task_id: string;
          tipo: "link" | "arquivo";
          url: string;
          titulo: string | null;
          arquivo_nome: string | null;
          adicionado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          tipo: "link" | "arquivo";
          url: string;
          titulo?: string | null;
          arquivo_nome?: string | null;
          adicionado_por?: string | null;
        };
        Update: { titulo?: string | null };
        Relationships: [];
      };
      task_comentarios: {
        Row: {
          id: string;
          task_id: string;
          subtask_id: string | null;
          approval_round_id: string | null;
          autor_id: string;
          texto: string;
          interno: boolean;
          resposta_a: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          subtask_id?: string | null;
          approval_round_id?: string | null;
          autor_id: string;
          texto: string;
          interno?: boolean;
          resposta_a?: string | null;
        };
        Update: { texto?: string };
        Relationships: [];
      };

      /**
       * Post de social media.
       *
       * **O cliente só enxerga o que tem `enviado_em` preenchido**, e quem
       * decide isso é a policy `posts_select_cliente` (0032) — nenhuma
       * consulta do produto repete o filtro. `enviado_em` e `status` ficam
       * FORA de Insert e de Update: quem os escreve são o trigger
       * `approval_rounds_marca_post` e a função `decidir_rodada_do_cliente`,
       * a partir da rodada. Tentar gravá-los é erro de tipo antes de ser
       * recusa do banco — a mesma decisão do cronômetro da subtarefa.
       */
      /**
       * Um FLUXO de social: a corrente de etapas que os posts de um mês
       * percorrem, com os portões do cliente dentro dela (migration 0087).
       *
       * Decisão do usuário: *"algumas contas validam pauta e conteúdo, antes
       * de ir para Produção de Layout. E após o layout feito, ele também vai
       * para aprovação do cliente. Preciso poder montar fluxos de Social
       * diferentes, para serem aplicados em determinados socials, de meses de
       * determinadas contas"*.
       *
       * **SÃO DUAS TABELAS E NÃO UM `jsonb`**, pelo critério que o produto já
       * escreveu para `post_versions.arquivos`: jsonb é para o que se escreve
       * de uma vez e se lê inteiro, nunca consultado item a item. Um elo é
       * consultado item a item — `montar_etapas_do_post` percorre um por um, a
       * validação de `p_prazos` pergunta se existe etapa com aquele nome. É a
       * forma de `workflow_templates` + `workflow_steps` (0007), que é a
       * cadeia da demanda um módulo ao lado.
       *
       * `nome` é ÚNICO: a tela lista fluxos por nome, e dois "Padrão da casa"
       * na mesma lista são uma escolha que ninguém consegue fazer. Fluxo que
       * não serve mais se desativa — apagar levaria o nome que os meses já
       * abertos apontam.
       */
      social_flows: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        /**
         * **Sem Insert**: quem cria é `salvar_fluxo_de_social()`, porque o
         * fluxo e os elos dele são gravados juntos, numa transação só — a mesma
         * decisão de `workflow_templates` (0007). Pelo PostgREST seriam N+1
         * idas, e a terceira falhando deixaria um fluxo com metade da corrente,
         * que é exatamente o estado que o gatilho recusa.
         *
         * **E o Update aceita UMA coluna**, `ativo`: ela não encosta na
         * corrente, então o interruptor que tira um fluxo do ar não precisa
         * passar pela função que reescreve os elos. Nome e descrição ficam de
         * fora porque viajam JUNTO com a corrente na tela do editor — dois
         * caminhos para gravar o nome seriam dois lugares para esquecer de
         * revalidar a ficha do cliente.
         */
        Insert: never;
        Update: { ativo?: boolean; updated_at?: string };
        Relationships: [];
      };

      /**
       * Os elos de um fluxo de social, em ordem (migration 0087).
       *
       * **Sem Insert nem Update**, e aqui a ausência é mais forte que uma
       * convenção: o gatilho de coerência é POR INSTRUÇÃO, então um `insert`
       * por linha é recusado — a primeira volta deixaria o fluxo com um elo e
       * nenhuma entrega. Um fluxo é gravado de uma vez, pela ação que o grava.
       */
      social_flow_steps: {
        Row: {
          id: string;
          flow_id: string;
          /** Com folga de dez (10,20,30…) pela razão de `post_etapas.ordem`
           *  (0045): a etapa de Ajustes nasce ENTRE duas. */
          ordem: number;
          nome: string;
          funcao: TeamFuncao;
          papel: SocialFlowPapel;
          /** Só vale em elo de produção, e quem garante é um `check`: a
           *  entrega já É o portão e o pós-entrega vem depois da decisão. */
          aprovacao_cliente: boolean;
          /** Qual campo do card este elo enche: `pauta`, `legenda` ou nenhum
           *  (0046, virado coluna na 0087). */
          campo: string | null;
          /**
           * As duas pontas SUGERIDAS, contadas do dia 1 do mês (0083/0084).
           *
           * Elas viajam com o FLUXO e não com a tela, e a razão é a cadeia
           * editável: `ETAPAS_DA_CORRENTE` em TypeScript sabia sugerir os dias
           * das cinco etapas que ela mesma listava, e não sabe sugerir nada
           * para uma etapa que alguém acrescentou.
           */
          comeca_dias_antes: number | null;
          termina_dias_antes: number | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      posts: {
        Row: {
          id: string;
          client_id: string;
          subtask_id: string | null;
          tema: string;
          legenda: string | null;
          /** O que este post vai dizer, escrito na etapa Pauta (0046). É
           *  CONVERSA INTERNA — a legenda é que vai ao cliente e ao ar, e
           *  escrever a pauta nela mandaria a pauta junto. */
          pauta: string | null;
          // NULA ENQUANTO NINGUEM DEFINIU (0044). O mes de social abre em
          // branco e quem produz distribui as datas -- "sem data ainda" e um
          // estado de verdade do trabalho, e a coluna precisa conseguir
          // representa-lo. Post sem data nao vai ao cliente: quem recusa e
          // `validar_nova_rodada`, nao a tela.
          data_publicacao: string | null;
          horario: string | null;
          /**
           * AS REDES desta peça (0082). Lista, e `plataforma` singular foi
           * APAGADA: a mesma arte sai no Instagram e no Facebook, e uma
           * coluna "a rede principal" ao lado seria o segundo lugar onde o
           * mesmo fato diverge.
           */
          plataformas: PlataformaSocial[];
          formato: string | null;
          midia: PostMidia;
          // Video e por LINK e nao por upload (0042, decisao do usuario): o
          // visualizador do portal desenha <img>, e player e poster sao
          // entrega propria.
          video_url: string | null;
          status: ContentStatus;
          // A CAPA. Num carrossel e o primeiro slide, escrito pelo trigger
          // `post_versions_sincroniza` -- e por isso que o calendario, o card
          // e a miniatura do portal nao sabem que carrossel existe.
          arte_url: string | null;
          thumbnail_url: string | null;
          versao_atual: number;
          prazo_aprovacao: string | null;
          // Escrito pelo trigger `approval_rounds_marca_post` (0032), nunca a
          // mao: enviar E abrir a rodada de escopo cliente.
          enviado_em: string | null;
          // Para quem a gestao liberou a producao (0042). Nulo = ninguem
          // pegou. NAO e `criado_por`: depois da 0042 quem cria e a gestao,
          // que abre o briefing, e quem produz e esta pessoa.
          responsavel_id: string | null;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          subtask_id?: string | null;
          tema: string;
          legenda?: string | null;
          pauta?: string | null;
          data_publicacao?: string | null;
          horario?: string | null;
          plataformas: PlataformaSocial[];
          formato?: string | null;
          midia?: PostMidia;
          video_url?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          prazo_aprovacao?: string | null;
          responsavel_id?: string | null;
          criado_por?: string | null;
        };
        Update: {
          tema?: string;
          legenda?: string | null;
          pauta?: string | null;
          // E DE QUEM PRODUZ, desde a 0044 (decisao do usuario): a Social
          // Media distribui o mes. O trigger `posts_protege_colunas` deixou de
          // recusar o colaborador aqui.
          data_publicacao?: string | null;
          horario?: string | null;
          plataformas?: PlataformaSocial[];
          formato?: string | null;
          midia?: PostMidia;
          video_url?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          prazo_aprovacao?: string | null;
          subtask_id?: string | null;
          status?: ContentStatus;
          // Quem libera e a gestao: o trigger `posts_protege_colunas` (0042)
          // recusa o colaborador que tentar, e a recusa diz por que.
          responsavel_id?: string | null;
        };
        Relationships: [];
      };

      /**
       * As referências de apoio de um post (0046).
       *
       * Mesma forma de `task_referencias`, de propósito: quem sabe mexer numa
       * sabe mexer na outra. `tipo` fica de fora — aqui é sempre link, porque
       * a arte tem lugar próprio (a versão) e um arquivo solto no meio das
       * referências seria uma segunda porta para o material final.
       *
       * **SEM Update**, e a ausência é a regra: editar o endereço de uma
       * referência que alguém já abriu é trocar o destino embaixo de quem a
       * leu. Apaga e põe outra. `adicionado_por` também fica fora — quem
       * assina é o trigger, porque policy não limita coluna.
       */
      post_referencias: {
        Row: {
          id: string;
          post_id: string;
          url: string;
          titulo: string | null;
          adicionado_por: string | null;
          created_at: string;
        };
        Insert: {
          post_id: string;
          url: string;
          titulo?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      /**
       * A corrente de trabalho de um post (0045).
       *
       * Pauta → Conteúdo → Layout → Envio → Programar, e "Ajustes" entre as
       * duas últimas quando o cliente pede. Cada etapa tem uma função e uma
       * pessoa: até a 0044 o post tinha UMA mão por vez, o que descreve quem
       * pode escrever e não quem faz o quê.
       *
       * `concluida_em` fica fora de Insert e de Update: quem carimba é o
       * trigger `post_etapas_regras`, e uma etapa concluída sem data de
       * conclusão não serve para relatório nenhum.
       */
      post_etapas: {
        Row: {
          id: string;
          post_id: string;
          /** Com folga entre os números (10,20,30,40,50): a etapa de Ajustes
           *  nasce ENTRE Envio e Programar, e sequencial ela obrigaria a
           *  renumerar as seguintes por causa de um pedido do cliente. */
          ordem: number;
          nome: string;
          funcao: TeamFuncao;
          responsavel_id: string | null;
          status: SubtaskStatus;
          /**
           * O PERIODO desta etapa, escolhido ao abrir o mes e IGUAL para todos
           * os posts dele (0083/0084): a Pauta dos doze comeca num dia e fecha
           * noutro.
           *
           * Ate a 0083 o fim era calculado a partir de `prazo_offset_dias` --
           * dias antes da publicacao de CADA post --, e a coluna da regra saiu
           * junto com os dois triggers que a serviam. A 0084 acrescentou a
           * outra ponta, pela decisao da 0027: *"duas etapas com o mesmo prazo
           * podem ser uma de tres dias e uma de tres horas"*.
           *
           * Os DOIS sao opcionais, tambem pela 0027 -- quem abre o mes costuma
           * saber quando a etapa fecha e ainda nao quando ela comeca. O fim
           * continua se chamando `prazo` e nao `data_fim` porque renomear
           * coluna em uso e migration arriscada sem nada em troca.
           */
          data_inicio: string | null;
          prazo: string | null;
          /**
           * Esta etapa passa pelo CLIENTE antes de a próxima começar (0076).
           *
           * Nasce do elo do FLUXO que o post percorre (0087) e a gestão troca
           * por post. A entrega não precisa dela: ela É o portão do cliente
           * desde a 0045 — e quem for marcá-la aqui por engano não consegue,
           * porque o `check` de `social_flow_steps` a recusa fora de um elo de
           * produção.
           */
          aprovacao_cliente: boolean;
          /**
           * O PAPEL deste elo (0087), e ele é a coluna que tirou a palavra
           * 'Envio' de seis comparações do produto.
           *
           * Com a corrente fixa, `nome = 'Envio'` respondia "esta é a entrega
           * ao cliente". Com fluxos editáveis isso vira o furo mais caro que
           * a 0087 podia criar: um fluxo que chame aquele elo de "Entrega"
           * ficaria SEM PORTÃO NENHUM, sem erro em lugar nenhum — o mês abre,
           * os posts nascem, e "Enviar ao cliente" fica desligado para sempre.
           *
           * Copiado do fluxo no instante em que o post nasceu, nunca deduzido
           * do nome.
           */
          papel: SocialFlowPapel;
          /**
           * Qual campo do card este elo enche (0046, virado coluna na 0087):
           * `pauta`, `legenda` ou nenhum.
           *
           * O de-para era `case e.nome when 'Pauta' then p.pauta`, e renomear
           * a etapa fazia a tela do portal abrir o portão com a caixa de texto
           * VAZIA — o cliente decidindo sobre nada.
           */
          campo: string | null;
          concluida_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          ordem: number;
          nome: string;
          funcao: TeamFuncao;
          responsavel_id?: string | null;
          status?: SubtaskStatus;
          prazo?: string | null;
          aprovacao_cliente?: boolean;
          papel?: SocialFlowPapel;
          campo?: string | null;
        };
        Update: {
          /** O que o RESPONSÁVEL troca é o status, e mais nada — o resto o
           *  trigger recusa para quem não é gestão. Policy não limita
           *  coluna. */
          status?: SubtaskStatus;
          nome?: string;
          funcao?: TeamFuncao;
          ordem?: number;
          responsavel_id?: string | null;
          prazo?: string | null;
          aprovacao_cliente?: boolean;
          papel?: SocialFlowPapel;
          campo?: string | null;
        };
        Relationships: [];
      };

      /**
       * O histórico de artes e legendas de um post.
       *
       * `numero_versao` fica fora de Insert: quem numera é o trigger
       * `post_versions_numera`, para duas abas salvando ao mesmo tempo não
       * baterem no `unique`.
       */
      post_versions: {
        Row: {
          id: string;
          post_id: string;
          numero_versao: number;
          arte_url: string | null;
          thumbnail_url: string | null;
          // Os slides desta versao, em ordem. A CAPA continua em
          // `posts.arte_url`, alimentada pelo primeiro slide.
          arquivos: ArquivoDaVersao[];
          /** Esta versão APAGOU o material do post (0048).
           *
           *  É coluna e não array vazio porque `arquivos` é `not null default
           *  '[]'`: vazio quer dizer "esta versão não falou de arquivo", que é
           *  o caso de toda versão que só mexe na legenda. */
          removeu_arquivos: boolean;
          video_url: string | null;
          legenda: string | null;
          notas_mudanca: string | null;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivos?: ArquivoDaVersao[];
          removeu_arquivos?: boolean;
          video_url?: string | null;
          legenda?: string | null;
          notas_mudanca?: string | null;
          criado_por?: string | null;
        };
        Update: { notas_mudanca?: string | null };
        Relationships: [];
      };

      /**
       * Comentário de post ou de entregável.
       *
       * `interno` está no Insert de propósito: a equipe escolhe. O que impede
       * o cliente de escolher não é o tipo — é o trigger `comments_normaliza`,
       * que reescreve para `false` quem não é da equipe. Policy não limita
       * coluna, e tipo muito menos.
       *
       * Sem Update: comentário preso a uma rodada é o registro do que foi
       * pedido e do que foi respondido, e não se reescreve.
       */
      comments: {
        Row: {
          id: string;
          content_type: TipoDeConteudo;
          content_id: string;
          approval_round_id: string | null;
          autor_id: string;
          texto: string;
          resposta_a: string | null;
          interno: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_type: TipoDeConteudo;
          content_id: string;
          approval_round_id?: string | null;
          autor_id: string;
          texto: string;
          resposta_a?: string | null;
          interno?: boolean;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      /**
       * O formato de campanha da casa -- a Wave e o que mais vier.
       *
       * `estrutura_json` e uma arvore em `jsonb`, e nao um par de tabelas como
       * o workflow de task. A diferenca e o que se faz com cada um: o workflow
       * guarda funcao, prazo relativo e responsavel por etapa, coisas que se
       * consultam; isto aqui e uma lista de nomes que alguem edita inteira
       * antes de salvar. Normalizar seria criar duas tabelas para servir um
       * `select * where id = ?`.
       *
       * `client_id` nulo e template da casa, que serve a todo cliente.
       */
      campaign_templates: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          estrutura_json: EstruturaDeTemplate;
          client_id: string | null;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          estrutura_json: EstruturaDeTemplate;
          client_id?: string | null;
          ativo?: boolean;
          criado_por?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          estrutura_json?: EstruturaDeTemplate;
          ativo?: boolean;
        };
        Relationships: [];
      };

      campaigns: {
        Row: {
          id: string;
          client_id: string;
          nome: string;
          descricao: string | null;
          data_inicio: string;
          data_fim: string;
          template_id: string | null;
          status: CampaignStatus;
          capa_url: string | null;
          // A DEMANDA da campanha (0051). Fica FORA de Insert e de Update:
          // quem liga as duas e `abrir_campanha()`, numa transacao so. Ligar
          // a mao daria campanha apontando para demanda de outro cliente.
          task_id: string | null;
          drive_folder_id: string | null;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nome: string;
          descricao?: string | null;
          data_inicio: string;
          data_fim: string;
          template_id?: string | null;
          status?: CampaignStatus;
          capa_url?: string | null;
          drive_folder_id?: string | null;
          criado_por?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          data_inicio?: string;
          data_fim?: string;
          status?: CampaignStatus;
          capa_url?: string | null;
          drive_folder_id?: string | null;
        };
        Relationships: [];
      };

      /**
       * Um entregavel da campanha. `parent_id` nulo e item de topo.
       *
       * **`status` esta no Update, e no grupo ele e descartado.** Quem tem
       * filho para de ser unidade de trabalho -- a mesma regra da Task com as
       * subtarefas e da etapa com as sub-etapas --, e o status que o grupo
       * mostra sai de `status_do_entregavel()`. Descartar em vez de recusar e
       * escolha: quem edita um grupo quase sempre esta mexendo no nome, na
       * ordem ou no prazo, e recusar o update inteiro por causa de um campo
       * que a tela nem mostra travaria o trabalho para proteger um valor que
       * ninguem le.
       *
       * **`enviado_em` fica fora dos dois.** Quem carimba e o trigger
       * `approval_rounds_marca_conteudo`, no instante em que a rodada de
       * escopo cliente nasce: enviar E abrir a rodada. Separados, daria para
       * ter rodada de um material que o cliente nao enxerga.
       */
      deliverables: {
        Row: {
          id: string;
          campaign_id: string;
          parent_id: string | null;
          subtask_id: string | null;
          nome: string;
          descricao: string | null;
          ordem: number;
          status: ContentStatus;
          prazo: string | null;
          arte_url: string | null;
          thumbnail_url: string | null;
          arquivo_nome: string | null;
          versao_atual: number;
          responsavel_id: string | null;
          enviado_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          parent_id?: string | null;
          subtask_id?: string | null;
          nome: string;
          descricao?: string | null;
          ordem?: number;
          status?: ContentStatus;
          prazo?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivo_nome?: string | null;
          responsavel_id?: string | null;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          ordem?: number;
          status?: ContentStatus;
          prazo?: string | null;
          arte_url?: string | null;
          thumbnail_url?: string | null;
          arquivo_nome?: string | null;
          responsavel_id?: string | null;
          subtask_id?: string | null;
        };
        Relationships: [];
      };

      /**
       * O historico de arquivos de um entregavel.
       *
       * `numero_versao` fica fora de Insert pela mesma razao de
       * `post_versions`: quem numera e o trigger, para duas abas salvando ao
       * mesmo tempo nao baterem no `unique`.
       *
       * Sem Update nem Delete do lado do cliente -- e a ausencia de policy de
       * escrita e a trava, nao a ausencia do botao: reverter muda o que vai
       * ao ar, e quem responde por isso e a agencia.
       */
      deliverable_versions: {
        Row: {
          id: string;
          deliverable_id: string;
          numero_versao: number;
          arte_url: string | null;
          // Os arquivos desta versao, ordenados (0053). Mesma forma de
          // `post_versions.arquivos`: a capa e a primeira IMAGEM da lista.
          arquivos: Json;
          thumbnail_url: string | null;
          arquivo_nome: string | null;
          notas_mudanca: string | null;
          criado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deliverable_id: string;
          arte_url?: string | null;
          arquivos?: Json;
          thumbnail_url?: string | null;
          arquivo_nome?: string | null;
          notas_mudanca?: string | null;
          criado_por?: string | null;
        };
        Update: { notas_mudanca?: string | null };
        Relationships: [];
      };
      /**
       * Convenções, feiras, lançamentos, reuniões e feriados de cliente
       * (migration 0055).
       *
       * `client_id` nulo = evento da agência inteira, e é por isso que a
       * coluna aceita nulo em vez de exigir um cliente: reunião de equipe e
       * treinamento interno não pertencem a conta nenhuma.
       */
      events: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          tipo: EventoTipo;
          client_id: string | null;
          data_inicio: string;
          data_fim: string;
          dia_inteiro: boolean;
          hora_inicio: string | null;
          hora_fim: string | null;
          local: string | null;
          link: string | null;
          cor: string | null;
          bloqueia_ferias: boolean;
          criado_por: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          tipo?: EventoTipo;
          client_id?: string | null;
          data_inicio: string;
          data_fim: string;
          dia_inteiro?: boolean;
          hora_inicio?: string | null;
          hora_fim?: string | null;
          local?: string | null;
          link?: string | null;
          cor?: string | null;
          bloqueia_ferias?: boolean;
          criado_por: string;
        };
        Update: {
          nome?: string;
          descricao?: string | null;
          tipo?: EventoTipo;
          client_id?: string | null;
          data_inicio?: string;
          data_fim?: string;
          dia_inteiro?: boolean;
          hora_inicio?: string | null;
          hora_fim?: string | null;
          local?: string | null;
          link?: string | null;
          cor?: string | null;
          bloqueia_ferias?: boolean;
        };
        Relationships: [];
      };
      /**
       * Quem vai. VAZIO QUER DIZER TODO MUNDO — e não "ninguém": um evento da
       * agência não lista as dez pessoas uma a uma (migration 0055).
       */
      event_participants: {
        Row: { id: string; event_id: string; user_id: string };
        Insert: { id?: string; event_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      academy_reordenar: { Args: { p_track_id: string; p_ids: string[] }; Returns: number };
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_socio: { Args: Record<string, never>; Returns: boolean };
      is_gestor: { Args: Record<string, never>; Returns: boolean };
      is_atendimento: { Args: Record<string, never>; Returns: boolean };
      pode_editar_task: { Args: { p_task_id: string }; Returns: boolean };
      /**
       * Os equipamentos que estao e que estiveram comigo (0069).
       *
       * Ela existe porque `assets_select` e `is_gestor()`: a linha do
       * equipamento carrega valor de aquisicao e nota fiscal, e policy nao
       * limita coluna. O recorte seguro sai daqui, e NAO tem essas duas.
       */
      meus_comodatos: {
        Args: Record<string, never>;
        Returns: {
          loan_id: string;
          asset_id: string;
          codigo: string | null;
          tipo: AssetTipo;
          nome: string;
          marca: string | null;
          modelo: string | null;
          numero_serie: string | null;
          foto_url: string | null;
          data_entrega: string;
          data_prevista_devolucao: string | null;
          data_devolucao: string | null;
          estado_entrega: AssetEstado;
          estado_devolucao: AssetEstado | null;
          acessorios: string | null;
          observacoes_entrega: string | null;
          termo_corpo: string | null;
          aceito_em: string | null;
          devolvido: boolean;
        }[];
      };
      confirmar_recebimento: { Args: { p_loan_id: string }; Returns: undefined };
      reportar_problema_do_comodato: {
        Args: { p_loan_id: string; p_texto: string };
        Returns: undefined;
      };
      /** O que ainda esta com uma pessoa — o que o desligamento mostra. */
      comodatos_em_aberto_de: {
        Args: { p_user_id: string };
        Returns: { loan_id: string; codigo: string | null; nome: string; data_entrega: string }[];
      };
      /**
       * As etapas de um workflow com o responsavel JA RESOLVIDO para uma conta
       * (migration 0064).
       *
       * A ordem e a regra, e mora no banco para a bateria poder fixa-la:
       * pessoa explicita na etapa, senao a pessoa daquela funcao no cliente,
       * senao nulo. Pessoa desligada nao entra.
       *
       * `funcao_sem_dono` diz QUAL funcao faltou, e existe para a tela poder
       * nomea-la em vez de dizer "alguma etapa ficou sem dono".
       *
       * O prazo NAO vem daqui: ele sai de `data_inicio + prazo_offset_dias`, e
       * o inicio e da demanda, nao do workflow.
       */
      etapas_resolvidas_do_workflow: {
        Args: { p_template_id: string; p_client_id: string };
        Returns: {
          ordem: number;
          nome: string;
          responsavel_id: string | null;
          funcao_padrao: TeamFuncao | null;
          funcao_sem_dono: TeamFuncao | null;
          prioridade: TaskPrioridade;
          prazo_offset_dias: number | null;
          requer_aprovacao: boolean;
          tipo_aprovacao: TipoAprovacao | null;
          depende_de_ordem: number | null;
        }[];
      };
      /**
       * Quem da equipe ainda nao tem nota viva no mes (0066).
       *
       * A TELA CHAMA ANTES DO CLIQUE, e e a razao de ela existir separada de
       * `solicitar_notas_do_mes`: o dialogo diz quantas pessoas vao receber, e
       * um numero diferente do que sai seria a tela mentindo sobre o que o
       * botao acabou de fazer. E a decisao de `podeEnviarAoCliente()`.
       *
       * So o socio -- a primeira linha da funcao estoura para todo mundo.
       */
      quem_deve_nota: {
        Args: { p_competencia: string };
        Returns: { user_id: string; nome: string }[];
      };
      /**
       * Avisa quem ainda nao mandou a nota do mes e grava o pedido (0066).
       * Devolve quantas pessoas foram alcancadas.
       */
      solicitar_notas_do_mes: { Args: { p_competencia: string }; Returns: number };
      /**
       * Os meses em que a equipe me cobrou a nota e eu ainda nao mandei, com a
       * data do ultimo pedido -- que E o prazo (0066).
       *
       * `security definer` porque a policy de `invoice_requests` e do socio e
       * continua sendo: abrir o SELECT para `is_staff()` entregaria de lambuja
       * o `quantas_pessoas` de cada pedido, numa tela pessoal onde quantos
       * colegas estao devendo nao decide nada.
       */
      meus_pedidos_de_nota: {
        Args: Record<string, never>;
        Returns: { competencia: string; pedido_em: string }[];
      };
      pode_aprovar_subtarefa: { Args: { p_subtask_id: string }; Returns: boolean };
      subtask_liberada: { Args: { p_subtask_id: string }; Returns: boolean };
      subtask_pendencias: { Args: { p_subtask_id: string }; Returns: string | null };
      /**
       * As pessoas com acesso as empresas de quem pergunta, com a data do
       * ultimo login (migration 0031).
       *
       * `security definer` porque devolve um agregado que a policy de
       * `client_access_log` nao deixaria montar linha a linha -- ela esconde o
       * rastro alheio de proposito, e a aba Usuarios precisa da DATA sem
       * precisar da lista.
       */
      usuarios_do_meu_cliente: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          nome: string;
          email: string;
          ultimo_acesso: string | null;
        }[];
      };
      decidir_rodada_do_cliente: {
        Args: { p_round_id: string; p_decisao: StatusRodada; p_comentario: string | null };
        Returns: void;
      };
      /**
       * O portão da corrente que espera o cliente, e o texto dele (0076).
       *
       * Devolve zero linhas no caminho de sempre — o do Envio —, e é por isso
       * que a tela do portal trata a lista vazia como "nada a anunciar" em vez
       * de erro. `security definer` porque o cliente não tem policy em
       * `post_etapas` e não passa a ter.
       */
      o_que_o_cliente_decide: {
        Args: { p_post_id: string };
        Returns: { etapa: string; texto: string | null }[];
      };
      my_client_ids: { Args: Record<string, never>; Returns: string[] };

      // --- Cronometro da subtarefa (migration 0021) -----------------------
      // O gemeo em TypeScript e `minutosMedidos()`, em `lib/dominio/tempo.ts`.
      // Esta aqui serve a consulta e ao relatorio; a tela usa a de la, que
      // corre a cada segundo sem ir ao banco.
      tempo_medido_da_subtarefa: { Args: { p_subtask_id: string }; Returns: number | null };

      // --- Full Days e notificacoes (migration 0011) ----------------------
      dias_uteis: { Args: { inicio: string; fim: string }; Returns: number };
      dias_do_pedido: {
        Args: { p_tipo: HrTipo; p_inicio: string; p_fim: string };
        Returns: number;
      };
      /**
       * Saldo de descanso: tudo o que os ciclos de 12 meses ja concederam,
       * menos tudo o que a pessoa ja tirou (migration 0039).
       *
       * SEM O ANO, e e a mudanca inteira: era `(p_user_id, p_ano)`. O nome
       * ficou no vocabulario antigo pela decisao da 0016 -- nome de funcao e
       * de coluna nao se renomeia em uso, e ninguem que usa o sistema os ve.
       */
      saldo_de_ferias: { Args: { p_user_id: string }; Returns: number };
      parcelas_de_ferias: { Args: { p_user_id: string }; Returns: number };
      parcelas_concedidas: { Args: { p_user_id: string }; Returns: number };
      ciclos_de_descanso: { Args: { p_user_id: string }; Returns: number };
      inicio_do_ciclo: { Args: { p_user_id: string }; Returns: string | null };
      /**
       * Tudo o que a tela do saldo precisa, numa chamada so.
       *
       * A tela somava no navegador a partir da lista de pedidos e o banco
       * calculava a mesma coisa por outro caminho para validar. No modelo de
       * ciclo a conta depende da data de entrada, que a lista de pedidos nem
       * carrega -- entao ou a tela pergunta, ou mostra um numero que a trava
       * nao cumpre.
       */
      descanso_do_ciclo: {
        Args: { p_user_id: string };
        Returns: {
          inicio_do_ciclo: string | null;
          /**
           * O dia em que o próximo bloco de dias é conquistado — o próximo
           * aniversário da entrada (0074). É o que a tela mostra para quem
           * está no primeiro ciclo, onde `saldo` é zero: "0 de 0 dias" é
           * verdade e não diz nada, e a data responde por que.
           */
          proximo_em: string | null;
          ciclos: number;
          dias_concedidos: number;
          dias_usados: number;
          saldo: number;
          parcelas_concedidas: number;
          parcelas_usadas: number;
        }[];
      };
      /**
       * O dia em que a pessoa conquista o próximo bloco de dias (0074).
       *
       * A tela a recebe embutida em `descanso_do_ciclo`, e não a chama
       * direto: uma segunda ida ao banco para um campo que a primeira já
       * podia trazer é uma segunda chance de as duas discordarem.
       */
      proximo_descanso_em: { Args: { p_user_id: string }; Returns: string | null };
      decidir_solicitacao: {
        Args: { p_request_id: string; p_decisao: HrStatus; p_motivo: string | null };
        Returns: void;
      };
      cancelar_solicitacao: { Args: { p_request_id: string }; Returns: void };
      /**
       * Abre N posts de um cliente para um mês, SEM DATA (0044/0045).
       *
       * `p_quantidades` é uma LISTA de combinações desde a 0082 —
       * `[{"redes": ["instagram","facebook"], "quantidade": 12}]`, e doze no
       * Instagram junto com o Facebook são DOZE posts, não vinte e quatro. O
       * objeto da 0044 (`{"instagram": 12}`) é recusado com frase própria: ele
       * não sabe dizer combinação, porque a chave é uma rede só.
       * `p_responsaveis`
       * é `{"Social Media": uuid, "Redator": uuid, "Design": uuid}` — uma
       * pessoa por FUNÇÃO e não uma por etapa, porque a Pauta e o Programar do
       * mesmo post são da mesma social media.
       *
       * Transacional: ou nascem todos ou não nasce nenhum. Teto de 60 que
       * RECUSA em vez de cortar — aqui o número é digitado, e um zero a mais é
       * erro de digitação.
       */
      /**
       * Abre a campanha COM a demanda e as etapas, numa transacao so (0051).
       *
       * Cada entregavel vira uma etapa da Task da campanha; um grupo vira
       * etapa agrupadora, com os sub-itens como sub-etapas -- os mesmos tres
       * niveis que a demanda ja tinha.
       *
       * **Nao e `security definer`:** `campaigns_insert` e `tasks_insert`
       * continuam decidindo quem pode. Devolve o id da campanha.
       */
      /**
       * O resumo da tela inicial, num JSON so (0049).
       *
       * Os blocos que a pessoa PODE ver, decididos dentro da funcao: quem nao
       * e gestao recebe `meu_dia`, `precisa_de_mim` e `fora_hoje` e mais
       * nada. Nao e `security definer` -- `auth.uid()` e quem ela pergunta, e
       * o RLS continua valendo em cada `select` de dentro.
       */
      home_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      abrir_campanha: {
        Args: {
          p_cliente: string;
          p_nome: string;
          p_descricao: string | null;
          p_data_inicio: string;
          p_data_fim: string;
          p_status: CampaignStatus;
          p_link_entrega: string | null;
          p_briefing_rico: Json | null;
          p_briefing_texto: string | null;
          p_template: string | null;
          p_estrutura: Json;
        };
        Returns: string;
      };
      abrir_mes_de_social: {
        Args: {
          p_client_id: string;
          p_mes: string;
          p_quantidades: { redes: PlataformaSocial[]; quantidade: number }[];
          p_responsavel_id?: string | null;
          p_responsaveis?: Record<string, string>;
          /**
           * O PERÍODO de cada etapa (0084): `{"Pauta": {"inicio": "AAAA-MM-DD",
           * "fim": "AAAA-MM-DD"}}`. As duas pontas valem para o mês INTEIRO —
           * a Pauta dos doze posts começa num dia e fecha noutro.
           *
           * A chave é o NOME da etapa — Pauta e Programar são as duas de
           * Social Media, e uma chave por função daria às duas o mesmo
           * período. As duas formas antigas são recusadas com frase própria: o
           * número da 0059 e a data solta da 0083.
           */
          p_prazos?: Record<string, { inicio?: string; fim?: string }>;
          /**
           * A pasta de entrega da DEMANDA do mês (0061). Obrigatória quando
           * ela nasce; ignorada quando o mês já tem demanda — abrir o mesmo
           * mês duas vezes acrescenta etapas à que existe.
           */
          p_link_entrega?: string | null;
          /**
           * O FLUXO que este mês percorre (0087). Nulo cai no padrão da conta,
           * e depois no da casa.
           *
           * **Ele é ignorado quando o mês JÁ existe**, e é para isso que
           * `tasks.social_flow_id` serve: abrir o mesmo mês em duas vezes
           * acrescenta posts à demanda que está lá (0061), e sem aquela
           * leitura a segunda chamada daria ao mês duas correntes diferentes
           * dentro.
           */
          p_flow_id?: string | null;
        };
        Returns: number;
      };
      /**
       * Grava um fluxo de social com a corrente dele, numa transação só
       * (0087).
       *
       * **Não é `security definer`**, de propósito: `social_flows_write` é
       * `is_gestor()`, e é a policy que decide quem pode — não a função. Um
       * definer aqui entregaria a edição do fluxo ao colaborador, que é quem a
       * corrente manda trabalhar.
       *
       * `p_flow_id` com um fluxo que não existe CRIA com aquele id, e não
       * recusa: é o que deixa o seed e a bateria fixarem o id de um fluxo.
       */
      salvar_fluxo_de_social: {
        Args: {
          p_nome: string;
          /**
           * A corrente na ORDEM. `ordem` sai da posição na lista, com folga de
           * dez (0045) — a tela não a manda.
           */
          p_etapas: {
            nome: string;
            funcao: TeamFuncao;
            papel?: SocialFlowPapel;
            campo?: string | null;
            aprovacao_cliente?: boolean;
            comeca_dias_antes?: number | null;
            termina_dias_antes?: number | null;
          }[];
          p_flow_id?: string | null;
          p_descricao?: string | null;
          p_ativo?: boolean;
        };
        Returns: string;
      };
      /**
       * Os elos de um fluxo, em ordem (0087). Substitui
       * `etapas_padrao_do_social()` da 0045, que respondia pela única corrente
       * que existia.
       *
       * `security definer` pela razão de `porta_do_cliente_no_post`: ela é
       * chamada de dentro de `posts_corrente_do_cliente`, que roda com o
       * `auth.uid()` DO CLIENTE — e o cliente não tem policy em
       * `social_flow_steps`.
       */
      etapas_do_fluxo: {
        Args: { p_flow_id: string };
        Returns: {
          ordem: number;
          nome: string;
          funcao: TeamFuncao;
          papel: SocialFlowPapel;
          aprovacao_cliente: boolean;
          campo: string | null;
          comeca_dias_antes: number | null;
          termina_dias_antes: number | null;
        }[];
      };
      /** O fluxo que um mês de social vai usar: o escolhido, senão o padrão da
       *  conta, senão o da casa (0087). */
      fluxo_do_mes: {
        Args: { p_client_id: string; p_flow_id?: string | null };
        Returns: string | null;
      };
      /** O fluxo que vale para um post: o do mês dele, senão o da conta, senão
       *  o da casa (0087). */
      fluxo_do_post: {
        Args: { p_post_id: string };
        Returns: string | null;
      };
      /** O fluxo de social usado quando a conta e o mês não escolheram nenhum.
       *  Nulo quando não há fluxo ativo no banco (0087). */
      fluxo_padrao_da_casa: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      /**
       * Esta etapa e o agrupador de um post de social? Se sim: sem dono, sem
       * prazo, relogio parado e status calculado pela corrente (0061).
       */
      subtarefa_de_post: {
        Args: { p_subtask_id: string };
        Returns: boolean;
      };
      /**
       * Gera UMA ocorrencia e devolve o id da task, ou null quando outra
       * execucao chegou primeiro (a idempotencia e o indice unico, nao uma
       * consulta). `security definer`: escreve em `recurrence_runs`, que nao
       * tem policy de escrita nenhuma.
       */
      gerar_ocorrencia: {
        Args: { p_recurrence_id: string; p_periodo: string };
        Returns: string | null;
      };
      /** A rotina diaria. Erro numa regra nao impede as outras. */
      gerar_recorrencias: {
        Args: Record<string, never>;
        Returns: {
          recurrence_id: string;
          regra: string;
          geradas: number;
          erro: string | null;
        }[];
      };
      /** O inicio do proximo periodo que a regra ainda vai gerar, ou null. */
      proximo_periodo_da_recorrencia: {
        Args: { p_recurrence_id: string };
        Returns: string | null;
      };
      /**
       * Registra um periodo que ja aconteceu, em nome de outra pessoa
       * (migration 0037). Nasce `aprovada`, pinta a presenca na mesma
       * transacao, e recusa quem nao e `is_gestor()` na primeira linha.
       *
       * `p_origem` nao entra aqui: a tela lanca, e importar arquivo e outro
       * caminho. O default da funcao e `lancamento_retroativo`.
       */
      lancar_periodo: {
        Args: {
          p_user_id: string;
          p_tipo: HrTipo;
          p_data_inicio: string;
          p_data_fim: string;
          p_observacao?: string | null;
        };
        Returns: string;
      };
      /**
       * Corrige um lancamento e REPINTA a presenca. Recusa `solicitacao`.
       *
       * NAO TEM `p_tipo`, e nao e esquecimento da migration: trocar o tipo
       * muda a regra de contagem (corrido x util) e o que o periodo desconta,
       * o que e outro registro e nao uma correcao. Trocou o tipo: apaga e
       * lanca de novo.
       */
      corrigir_lancamento: {
        Args: {
          p_request_id: string;
          p_data_inicio: string;
          p_data_fim: string;
          p_observacao?: string | null;
        };
        Returns: void;
      };
      /** Apaga um lancamento e despinta os dias dele. Recusa `solicitacao`. */
      apagar_lancamento: { Args: { p_request_id: string }; Returns: void };
      // Os rascunhos DE QUEM ESTA LOGADO que somem amanha (migration 0028).
      rascunhos_a_expirar: {
        Args: Record<string, never>;
        Returns: { id: string; titulo: string; updated_at: string }[];
      };
      limpar_rascunhos_abandonados: { Args: Record<string, never>; Returns: number };
      /**
       * true quando as duas rotinas diarias estao agendadas e ativas no
       * pg_cron (0072). E o que faz a faixa de Recorrencias e o bloco de
       * rascunho da Home dizerem a verdade sem ninguem editar texto.
       */
      rotinas_agendadas: { Args: Record<string, never>; Returns: boolean };
      /**
       * A BUSCA DA TOPBAR (0073).
       *
       * Ela **não** é `security definer`: a RLS das nove tabelas é quem decide
       * o que cada perfil acha, e é por isso que a consulta daqui não repete
       * filtro nenhum.
       */
      busca_global: {
        Args: { p_termo: string; p_limite?: number };
        Returns: {
          tipo: string;
          id: string;
          titulo: string;
          contexto: string | null;
          caminho: string;
          selo: string | null;
          posicao: number;
          total: number;
        }[];
      };
      /**
       * O LIMITE DE TENTATIVAS (0056).
       *
       * As duas só são chamáveis pela CHAVE DE SERVIÇO: a migration revoga o
       * `execute` de `anon` e de `authenticated`, que o Supabase concede
       * sozinho a toda função nova. Sem isso, qualquer navegador com a chave
       * anon — que é pública, vai no bundle — chamaria `consumir_tentativa`
       * com a chave de OUTRA pessoa até estourar a cota dela: o limite que
       * protege o login viraria o jeito mais fácil de trancar alguém fora.
       *
       * **A tabela `rate_limits` NÃO tem tipo aqui, e é de propósito.**
       * Ninguém a lê pelo cliente tipado — a conta inteira mora nas duas
       * funções, e uma consulta direta seria uma segunda forma de contar.
       * É a mesma decisão de deixar `tempo_medido_segundos` fora de `Insert`
       * e de `Update`: tentar usar o caminho errado vira erro de tipo antes
       * de virar recusa do banco.
       */
      consumir_tentativa: {
        Args: { p_chave: string; p_max: number; p_janela: string };
        Returns: { permitido: boolean; tentativas: number; espere_segundos: number }[];
      };
      perdoar_tentativas: { Args: { p_chave: string }; Returns: undefined };
      /**
       * A carga de cada pessoa ativa em cada dia útil do período (0055).
       *
       * Ela PERCORRE e chama `carga_do_dia()`, que é a fonte única desde a
       * 0035 — não recalcula. Recusa período acima de 62 dias: a tela busca
       * o mês visível com uma semana de folga, e nunca o ano.
       */
      /**
       * A DISPONIBILIDADE DE QUEM VAI RECEBER O TRABALHO (0081).
       *
       * É a porta de quem delega, e `is_staff()` na primeira linha: ela
       * devolve título e cliente das etapas de OUTRA pessoa. A conta mora em
       * `disponibilidade_bruta()`, que não é chamável de fora — e por isso não
       * está declarada aqui.
       *
       * `p_modo` é `'distribuida'` (a estimativa repartida pela janela da
       * etapa) ou `'entregas'` (o que vence naquele dia, que é a outra
       * pergunta). Os dois últimos têm default e a tela manda os dois
       * explicitamente, porque quem lê a chamada precisa ver o que ela pede.
       */
      disponibilidade: {
        Args: {
          p_user_id: string;
          p_inicio: string;
          p_fim: string;
          p_modo?: string;
          p_incluir_concluidas?: boolean;
          p_daqui_pra_frente?: boolean;
        };
        Returns: {
          data: string;
          dia_util: boolean;
          capacidade_minutos: number;
          indisponivel_motivo: string | null;
          carga_minutos: number;
          etapas_count: number;
          etapas_sem_estimativa: number;
          entregas_count: number;
          entregas_minutos: number;
          ocupacao_pct: number | null;
          evento: string | null;
          itens: Json;
        }[];
      };
      /**
       * O MÊS DE SOCIAL E A DEMANDA DELE SÃO UMA COISA SÓ (0086).
       *
       * Decisão do usuário. `apagar_mes_de_social` apaga os posts e a
       * demanda numa transação só; `limpar_posts_do_mes` apaga só os posts e
       * deixa a estrutura, para quem errou a grade; `o_que_vai_com_o_mes`
       * conta antes, para o diálogo dizer o que sai em vez de perguntar "tem
       * certeza?".
       *
       * As três recusam quando algum post já foi ao cliente — e quem vale é o
       * trigger `tasks_apaga_o_social`, não elas: com a trava só aqui, apagar
       * a demanda no board seria a porta dos fundos.
       *
       * `posts_do_mes` não está declarada: ela é a ponte que as três usam por
       * dentro, e nenhuma tela a chama.
       */
      apagar_mes_de_social: {
        Args: { p_task_id: string };
        Returns: number;
      };
      limpar_posts_do_mes: {
        Args: { p_task_id: string };
        Returns: number;
      };
      o_que_vai_com_o_mes: {
        Args: { p_task_id: string };
        Returns: {
          posts: number;
          enviados: number;
          aprovados: number;
          versoes: number;
          etapas: number;
          comentarios: number;
        }[];
      };
      carga_da_equipe: {
        Args: { p_inicio: string; p_fim: string };
        Returns: {
          user_id: string;
          dia: string;
          minutos_comprometidos: number;
          etapas: number;
          etapas_sem_estimativa: number;
          ausente: boolean;
        }[];
      };
      /**
       * A CAMADA DE INDICADORES (0035).
       *
       * As cinco são `security definer` e recusam na PRIMEIRA linha quem não
       * pode: quatro exigem `is_gestor()`, e `rentabilidade_do_periodo`
       * exige `is_socio()` — faturamento por cliente é a informação mais
       * sensível da casa, e aqui não existe "só leitura para o gestor". Uma
       * recusa chega como erro do PostgREST, não como lista vazia: é a
       * diferença entre "você não pode" e "não há nada".
       *
       * Todas contam SÓ FOLHA e ignoram rascunho, e o filtro é
       * `publicada_em is not null` — `rascunho` não é valor de enum.
       */
      tempo_por_status: {
        Args: { p_de: string; p_ate: string };
        Returns: { status: string; minutos: number; ocorrencias: number }[];
      };
      tempo_de_aprovacao: {
        Args: { p_de: string; p_ate: string };
        Returns: {
          escopo: string;
          client_id: string | null;
          horas_media: number;
          rodadas: number;
          pendentes: number;
        }[];
      };
      producao_do_periodo: {
        Args: { p_de: string; p_ate: string; p_client_id?: string | null };
        Returns: {
          criadas: number;
          concluidas: number;
          atrasadas: number;
          no_prazo: number;
          fora_do_prazo: number;
          sem_prazo: number;
          minutos_reais: number;
        }[];
      };
      desvio_de_estimativa: {
        Args: { p_de: string; p_ate: string };
        Returns: {
          responsavel_id: string;
          etapas: number;
          minutos_estimados: number;
          minutos_reais: number;
          desvio_percentual: number;
        }[];
      };
      qualidade_da_entrega: {
        Args: { p_de: string; p_ate: string };
        Returns: {
          client_id: string | null;
          conteudos: number;
          aprovados_de_prima: number;
          rodadas_media: number;
          rejeitados: number;
        }[];
      };
      /** Só o sócio. `receita_por_hora` vem NULA quando ninguém lançou hora. */
      rentabilidade_do_periodo: {
        Args: { p_de: string; p_ate: string };
        Returns: {
          client_id: string | null;
          receita: number;
          despesa: number;
          horas: number;
          receita_por_hora: number | null;
        }[];
      };
      /**
       * A carga de UMA pessoa num dia. A fonte única da conta desde a 0035.
       *
       * `p_incluir_concluidas` nasceu na 0075 e tem default `false`, então
       * nenhum chamador antigo mudou. Ele existe para quem pergunta sobre um
       * período que **já passou**: sem ele, um mês fechado responde zero, e o
       * feedback dizia a quem entregou o mês inteiro que a entrega baixa dela
       * foi distribuição de trabalho.
       */
      carga_do_dia: {
        Args: {
          p_user_id: string;
          p_data: string;
          p_incluir_concluidas?: boolean;
        };
        Returns: {
          minutos_comprometidos: number;
          etapas: number;
          etapas_sem_estimativa: number;
        }[];
      };
      /**
       * Os números crus do período de UMA pessoa, para o feedback de
       * desenvolvimento (0075). A IA os recebe prontos — ela não calcula
       * nada. Só `is_gestor()` chama; a pessoa lê a cópia gravada em
       * `feedback_reports.metricas_json` do relatório **enviado**.
       */
      feedback_metricas: {
        Args: { p_user_id: string; p_de: string; p_ate: string };
        Returns: Json;
      };
      /**
       * O que impede a leitura errada dos números (0075): ausência, carga
       * contra capacidade, tempo parado esperando aprovação, cliente que pede
       * mais rodadas que a média das contas — e `ressalvas`, as frases prontas
       * que o prompt usa para RELATIVIZAR, nunca para cobrar.
       */
      feedback_contexto: {
        Args: { p_user_id: string; p_de: string; p_ate: string };
        Returns: Json;
      };
      /**
       * Grava os sinais que são da GESTÃO e não da pessoa (0075). Idempotente
       * pelo índice único: rodar de novo não empilha o mesmo alerta.
       */
      registrar_alertas_de_carga: {
        Args: { p_user_id: string; p_de: string; p_ate: string };
        Returns: number;
      };
      /**
       * Quem entra na geração do período, com quantas etapas cada pessoa
       * concluiu e se já tem relatório (0075). Mesma função para o diálogo e
       * para a geração — duas contas dariam um diálogo prometendo mais do que
       * a geração alcança.
       */
      quem_recebe_feedback: {
        Args: {
          p_de: string;
          p_ate: string;
          p_periodicidade?: FeedbackPeriodicidade;
        };
        Returns: {
          user_id: string;
          nome: string;
          concluidas: number;
          ja_tem: boolean;
          status_atual: FeedbackStatus | null;
        }[];
      };
      /**
       * A pessoa escolhe se quer receber o feedback (0075). Escreve UMA coluna
       * da própria linha: `team_members` é `is_gestor()` no UPDATE desde o
       * Sprint 2, e abrir uma policy ali daria junto a capacidade diária, o
       * saldo de descanso e a função dela — policy não limita coluna.
       */
      escolher_receber_feedback: {
        Args: { p_receber: boolean };
        Returns: boolean;
      };
      /** Guarda que esta pessoa leu a explicação do feedback (0075). Só na primeira vez. */
      marcar_feedback_explicado: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      /** Dias em que um evento com `bloqueia_ferias` atinge esta pessoa (0055). */
      eventos_que_bloqueiam: {
        Args: { p_user_id: string; p_inicio: string; p_fim: string };
        Returns: { dia: string; nome: string }[];
      };
      notificar: {
        Args: {
          /**
           * `string | null` desde a 0062, e a nulabilidade é o ponto: "não há
           * ninguém para avisar" não é erro, é a resposta — a função devolve
           * `null` sem derrubar a escrita que a chamou. Com o tipo em `string`,
           * quem passa uma coluna nulável (`clients.responsavel_atendimento_id`,
           * `feedback_reports.revisado_por`) é obrigado a um `?? ""`, que
           * inventaria um id e faria o `insert` estourar na chave estrangeira —
           * exatamente o bug que a 0062 desfez.
           */
          p_user_id: string | null;
          p_tipo: NotificationTipo;
          p_titulo: string;
          p_corpo?: string | null;
          p_link?: string | null;
        };
        Returns: string | null;
      };
    };
    Views: {
      /** Progresso SEM a coluna `anotacoes`. É por aqui que a aba
       *  Acompanhamento lê — policy não limita coluna, e a anotação é
       *  privada. Veja a migration 0017. */
      /**
       * Tudo o que tem data, num formato só (migration 0055).
       *
       * `security_invoker`: a RLS de cada tabela de origem continua valendo
       * por baixo. É SÓ LEITURA — não existe Insert nem Update, e é a forma
       * de dizer em tipo o que o banco diz em estrutura: escrever no
       * calendário é escrever na tabela de origem.
       */
      calendar_events: {
        Row: {
          id: string;
          tipo: TipoNoCalendario;
          titulo: string;
          data_inicio: string;
          data_fim: string;
          client_id: string | null;
          user_id: string | null;
          prioridade: string | null;
          status: string | null;
          link: string;
        };
        Relationships: [];
      };
      academy_progresso_da_equipe: {
        Row: {
          user_id: string;
          track_id: string;
          material_id: string;
          concluido: boolean;
          concluido_em: string | null;
        };
        Relationships: [];
      };
    };
    Enums: {
      user_role: UserRole;
      team_funcao: TeamFuncao;
      task_prioridade: TaskPrioridade;
      task_status: TaskStatus;
      subtask_status: SubtaskStatus;
      tipo_aprovacao: TipoAprovacao;
      escopo_rodada: EscopoRodada;
      material_tipo: MaterialTipo;
      rec_categoria: RecCategoria;
      status_rodada: StatusRodada;
      plataforma_social: PlataformaSocial;
      campaign_status: CampaignStatus;
      notification_tipo: NotificationTipo;
      evento_tipo: EventoTipo;
      hr_tipo: HrTipo;
      hr_status: HrStatus;
      hr_origem: HrOrigem;
      recorrencia_modo: RecorrenciaModo;
      recorrencia_frequencia: RecorrenciaFrequencia;
      presenca_status: PresencaStatus;
      skill_nivel: SkillNivel;
      fin_tipo: FinTipo;
      fin_status: FinStatus;
      contrato_recorrencia: ContratoRecorrencia;
      pf_tipo: PfTipo;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AcademyTrack = Database["public"]["Tables"]["academy_tracks"]["Row"];
export type AcademyMaterial = Database["public"]["Tables"]["academy_materials"]["Row"];
export type AcademyProgress = Database["public"]["Tables"]["academy_progress"]["Row"];
export type Recomendacao = Database["public"]["Tables"]["recommendations"]["Row"];
export type RecomendacaoComentario =
  Database["public"]["Tables"]["recommendation_comments"]["Row"];
export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientFlowDefaults =
  Database["public"]["Tables"]["client_flow_defaults"]["Row"];
export type ClientFunctionDefault =
  Database["public"]["Tables"]["client_function_defaults"]["Row"];
export type TeamInvoice = Database["public"]["Tables"]["team_invoices"]["Row"];
export type InvoiceRequest = Database["public"]["Tables"]["invoice_requests"]["Row"];
export type RequestType = Database["public"]["Tables"]["request_types"]["Row"];
export type ClientRequest = Database["public"]["Tables"]["client_requests"]["Row"];
export type RequestAttachment = Database["public"]["Tables"]["request_attachments"]["Row"];
export type RequestMessage = Database["public"]["Tables"]["request_messages"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type ClientUser = Database["public"]["Tables"]["client_users"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskRecurrence =
  Database["public"]["Tables"]["task_recurrences"]["Row"];
export type RecurrenceRun =
  Database["public"]["Tables"]["recurrence_runs"]["Row"];
export type Subtask = Database["public"]["Tables"]["subtasks"]["Row"];
export type TaskReferencia = Database["public"]["Tables"]["task_referencias"]["Row"];
export type TaskComentario = Database["public"]["Tables"]["task_comentarios"]["Row"];
export type SubtaskDependency = Database["public"]["Tables"]["subtask_dependencies"]["Row"];
export type ApprovalRound = Database["public"]["Tables"]["approval_rounds"]["Row"];
export type SubtaskEntrega = Database["public"]["Tables"]["subtask_entregas"]["Row"];
export type TaskHistory = Database["public"]["Tables"]["task_history"]["Row"];
export type TaskType = Database["public"]["Tables"]["task_types"]["Row"];
export type WorkflowTemplate = Database["public"]["Tables"]["workflow_templates"]["Row"];
export type WorkflowStep = Database["public"]["Tables"]["workflow_steps"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type HrRequest = Database["public"]["Tables"]["hr_requests"]["Row"];
export type TeamPresence = Database["public"]["Tables"]["team_presence"]["Row"];
export type Holiday = Database["public"]["Tables"]["holidays"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type FinanceCategory = Database["public"]["Tables"]["finance_categories"]["Row"];
export type FinanceEntry = Database["public"]["Tables"]["finance_entries"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostVersion = Database["public"]["Tables"]["post_versions"]["Row"];
export type PostEtapa = Database["public"]["Tables"]["post_etapas"]["Row"];
export type PostReferencia = Database["public"]["Tables"]["post_referencias"]["Row"];
export type Comentario = Database["public"]["Tables"]["comments"]["Row"];
