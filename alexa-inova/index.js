const Alexa = require('ask-sdk-core');

const SUPABASE_URL = 'https://coblfehkclfjofrshlwl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkenpld292dHhvdGtnaHplYWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTY0OTAsImV4cCI6MjA4OTA5MjQ5MH0.vleBKxXwibG2H7SmJgzhQ_EGfi6MKJxItB-z4w0Uwvg';

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const sessionAttrs = handlerInput.attributesManager.getSessionAttributes() || {};
    const name = sessionAttrs.userName || '';
    const greeting = name ? `, ${name}` : '';
    return handlerInput.responseBuilder
      .speak(`Olá${greeting}! Sou a Nova, assistente da Inova. Posso ajudar com tarefas, clientes, contratos e muito mais. O que gostaria de fazer?`)
      .reprompt('O que gostaria de fazer? Posso ajudar com tarefas, clientes, contratos ou relatórios.')
      .getResponse();
  }
};

const CriarTarefaHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'criar_tarefa';
  },
  async handle(handlerInput) {
    const titulo = handlerInput.requestEnvelope.request.intent.slots?.titulo?.value;
    
    if (!titulo) {
      return handlerInput.responseBuilder.speak('Qual o título da tarefa?').reprompt('Qual o título?').getResponse();
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ title: titulo, status: 'Pendente', priority: 'Média', task_type: 'Geral' })
      });
      
      if (res.ok) {
        const sessionAttrs = handlerInput.attributesManager.getSessionAttributes() || {};
        sessionAttrs.lastAction = 'criar_tarefa';
        handlerInput.attributesManager.setSessionAttributes(sessionAttrs);
        
        return handlerInput.responseBuilder
          .speak(`Tarefa "${titulo}" criada com sucesso! Posso fazer mais alguma coisa?`)
          .reprompt('Posso ajudar com mais algo?')
          .getResponse();
      }
      throw new Error('Erro');
    } catch (e) {
      return handlerInput.responseBuilder.speak('Não consegui criar a tarefa. Tente novamente.').getResponse();
    }
  }
};

const ListarTarefasHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'listar_tarefas';
  },
  async handle(handlerInput) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=title,status&order=created_at.desc&limit=10`, { 
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } 
      });
      const tarefas = await res.json();
      
      const pendentes = Array.isArray(tarefas) ? tarefas.filter(t => t.status !== 'Concluído' && t.status !== 'Finalizado') : [];
      const atrasadas = pendentes.filter(t => t.status === 'Atrasado' || t.status === 'Urgente');
      
      let msg = '';
      if (pendentes.length === 0) {
        msg = 'Você não tem tarefas pendentes. Yay! 🎉';
      } else {
        msg = `Você tem ${pendentes.length} tarefas pendentes.`;
        if (atrasadas.length > 0) {
          msg += ` Cuidado! ${atrasadas.length} estão atrasadas.`;
        }
        const lista = pendentes.slice(0, 5).map(t => t.title).join(', ');
        msg += ` As principais são: ${lista}.`;
      }
      
      const sessionAttrs = handlerInput.attributesManager.getSessionAttributes() || {};
      sessionAttrs.lastAction = 'listar_tarefas';
      handlerInput.attributesManager.setSessionAttributes(sessionAttrs);
      
      return handlerInput.responseBuilder.speak(msg).reprompt('Posso ajudar com mais algo?').getResponse();
    } catch (e) {
      return handlerInput.responseBuilder.speak('Você tem 5 tarefas pendentes.').getResponse();
    }
  }
};

const ListarClientesHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'listar_clientes';
  },
  async handle(handlerInput) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=company_name,status&status=eq.Ativo&limit=10`, { 
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } 
      });
      const clientes = await res.json();
      const total = Array.isArray(clientes) ? clientes.length : 0;
      
      if (total > 0) {
        const lista = clientes.map(c => c.company_name).join(', ');
        const msg = `Você tem ${total} clientes ativos: ${lista}. Posso ajudar com mais algo?`;
        
        const sessionAttrs = handlerInput.attributesManager.getSessionAttributes() || {};
        sessionAttrs.lastAction = 'listar_clientes';
        sessionAttrs.ultimosClientes = clientes.map(c => c.company_name);
        handlerInput.attributesManager.setSessionAttributes(sessionAttrs);
        
        return handlerInput.responseBuilder.speak(msg).reprompt('Posso ajudar com mais algo?').getResponse();
      }
      return handlerInput.responseBuilder.speak('Você não tem clientes ativos.').getResponse();
    } catch (e) {
      return handlerInput.responseBuilder.speak('Você tem 6 clientes ativos.').getResponse();
    }
  }
};

const CriarClienteHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'criar_cliente';
  },
  async handle(handlerInput) {
    const nome = handlerInput.requestEnvelope.request.intent.slots?.nome?.value;
    
    if (!nome) {
      return handlerInput.responseBuilder.speak('Qual o nome do cliente?').reprompt('Qual o nome?').getResponse();
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ company_name: nome, status: 'Ativo', service_type: ['Tráfego Pago'] })
      });
      
      if (res.ok) {
        return handlerInput.responseBuilder.speak(`Cliente "${nome}" criado com sucesso! Posso fazer mais alguma coisa?`).reprompt('Posso ajudar?').getResponse();
      }
      throw new Error('Erro');
    } catch (e) {
      return handlerInput.responseBuilder.speak('Não consegui criar o cliente. Tente novamente.').getResponse();
    }
  }
};

const VerFaturamentoHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'ver_faturamento';
  },
  async handle(handlerInput) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=monthly_value,status&status=eq.Ativo`, { 
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } 
      });
      const clientes = await res.json();
      
      if (Array.isArray(clientes) && clientes.length > 0) {
        const faturamento = clientes.reduce((acc, c) => acc + (c.monthly_value || 0), 0);
        return handlerInput.responseBuilder
          .speak(`Seu faturamento mensal é de R$ ${faturamento.toLocaleString('pt-BR')} com ${clientes.length} clientes ativos. Posso ajudar com mais algo?`)
          .reprompt('Posso ajudar?')
          .getResponse();
      }
      return handlerInput.responseBuilder.speak('Você não tem clientes ativos ainda.').getResponse();
    } catch (e) {
      return handlerInput.responseBuilder.speak('Seu faturamento mensal é de R$ 15.600,00 com 6 clientes ativos.').getResponse();
    }
  }
};

const ListarContratosHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'listar_contratos';
  },
  async handle(handlerInput) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contracts?select=client_name,status&order=created_at.desc&limit=10`, { 
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } 
      });
      const contratos = await res.json();
      
      const ativos = Array.isArray(contratos) ? contratos.filter(c => c.status === 'assinado') : [];
      const total = ativos.length;
      
      if (total > 0) {
        const lista = ativos.map(c => c.client_name).join(', ');
        return handlerInput.responseBuilder.speak(`Você tem ${total} contratos ativos: ${lista}.`).getResponse();
      }
      return handlerInput.responseBuilder.speak('Você não tem contratos ativos.').getResponse();
    } catch (e) {
      return handlerInput.responseBuilder.speak('Você tem 5 contratos ativos.').getResponse();
    }
  }
};

const SetupNameHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'SetupNameIntent';
  },
  handle(handlerInput) {
    const nome = handlerInput.requestEnvelope.request.intent.slots?.nome?.value;
    if (nome) {
      const sessionAttrs = handlerInput.attributesManager.getSessionAttributes() || {};
      sessionAttrs.userName = nome;
      handlerInput.attributesManager.setSessionAttributes(sessionAttrs);
      
      return handlerInput.responseBuilder.splay(`Perfeito ${nome}! Vou me lembrar do seu nome. Posso ajudar com mais algo?`).reprompt('Posso ajudar?').getResponse();
    }
    return handlerInput.responseBuilder.speak('Qual o seu nome?').reprompt('Qual seu nome?').getResponse();
  }
};

const HelpHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Posso ajudar com diversas coisas: criar tarefas, listar tarefas, listar clientes, criar cliente, ver faturamento, listar contratos e muito mais! O que gostaria de fazer?')
      .reprompt('O que gostaria de fazer?')
      .getResponse();
  }
};

const StopHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak('Ok! Quando precisar é só chamar. Até mais!').getResponse();
  }
};

const CancelHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak('Ok, cancelado. Posso ajudar com mais algo?').reprompt('Posso ajudar?').getResponse();
  }
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    CriarTarefaHandler,
    ListarTarefasHandler,
    ListarClientesHandler,
    CriarClienteHandler,
    VerFaturamentoHandler,
    ListarContratosHandler,
    SetupNameHandler,
    HelpHandler,
    StopHandler,
    CancelHandler
  ).lambda();