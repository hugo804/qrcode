import { PrismaClient } from "@prisma/client";
import { error } from "console";
import cors from 'cors';
import express from 'express';
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const saltRounds = 10;
require('dotenv').config();
const dated = require('date-and-time');

const { Pool } = require('pg');


//jwtfgfrfgddgfhffj
const jwt = require('jsonwebtoken')
const SECRET = process.env.JWT_SECRET;
const SECRET_REDEFINICAO = process.env.JWT_SECRET_REDEFINICAO;
const SECRET_PESSOA = process.env.JWT_SECRET_PESSOA;



//axios
const axios = require('axios');
axios.defaults.headers.common['Authorization'] = `Bearer ${process.env.TOKEN_DE_SUA_CONTA_MP}`;

const PORT: string | number = process.env.PORT || 5001;

const app = express();

app.use(cors());

app.use(express.json());


interface Error {
  message: string;
};

//midware de verificação JWT válido.
function verifyJWT(req: any, res: any, next: any) {
  const token = req.headers['x-access-token'];
  jwt.verify(token, SECRET, (err: any, decoded: any) => {
    if (err) return res.status(401).end();
    req.userId = decoded.userId;
    next();
  })
}

//midware de verificação JWT redefinicao de senha.
function verifyJWT2(req: any, res: any, next: any) {
  const token = req.headers['x-access-token'];
  jwt.verify(token, SECRET_REDEFINICAO, (err: any, decoded: any) => {
    if (err) return res.status(401).json({
      error: `Invalid or Expired Token. Make sure you add a Header 
    Parameter named x-access-token with the token provided when an email to reset password has been sent.` });
    req.userId = decoded.userId;
    next();
  })
}

//midware de verificação JWT PESSOAufg
function verifyJwtPessoa(req: any, res: any, next: any) {
  const token = req.headers['x-access-token'];
  jwt.verify(token, SECRET_PESSOA, (err: any, decoded: any) => {
    if (err) return res.status(401).json({
      error: `Invalid or Expired Token. Make sure you add a Header 
    Parameter named x-access-token with the token provided when an email to reset password has been sent.` });
    req.userId = decoded.userId;
    next();
  })
}



function stringDateFormatted(time: number) {
  let result;
  let totalSeconds = time;
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;
  result = `${hours.toString().padStart(2, "0")}h:${minutes.toString().padStart(2, "0")}m`
  return result;
}


//INTEGRAÇÃO PIX V2

var valordoPixMaquinaBatomEfi01 = 0; //txid 70a8cacb59b53eac8ccb

var valordoPixPlaquinhaPixMP = 5000; //storeid 



function converterPixRecebido(valorPix: number) {
  var valorAux = 0;
  var ticket = 1;
  if (valorPix > 0 && valorPix >= ticket) {
    valorAux = valorPix;
    valorPix = 0;
    //creditos
    var creditos = valorAux / ticket;
    creditos = Math.floor(creditos);
    var pulsos = creditos * ticket;
    var pulsosFormatados = ("0000" + pulsos).slice(-4);
    return pulsosFormatados;
  } else {
    return "0000";
  }
}

//permite facilmente a alteração de valor do preço dos produtos.
function converterPixRecebidoDinamico(valorPix: number, pulso: number) {
  var valorAux = 0;
  var ticket = pulso;
  if (valorPix > 0 && valorPix >= ticket) {
    valorAux = valorPix;
    valorPix = 0;
    //creditos
    var creditos = valorAux / ticket;
    creditos = Math.floor(creditos);
    //var pulsos = creditos * ticket;
    var pulsosFormatados = ("0000" + creditos).slice(-4);
    return pulsosFormatados;
  } else {
    return "0000";
  }
}

//Retorna em segundos o tempo desde a ultima Consulta efetuada em uma máquina.
function tempoOffline(data2: Date): number {
  var data1 = new Date();
  if (!(data1 instanceof Date) || !(data2 instanceof Date)) {
    throw new Error('Datas inválidas');
  }

  // Calcule a diferença em milissegundos
  const diferencaEmSegundos = Math.abs((data2.getTime() - data1.getTime()) / 1000);

  return diferencaEmSegundos;
}

async function notificar(urlDiscordWebhook: string, online: string, offline: string) {
  //An array of Discord Embeds.
  let embeds = [
    {
      title: "Monitoramento de Máquinas",
      color: 5174599,
      footer: {
        text: `📅 ${new Date()}`,
      },
      fields: [
        {
          name: "Online: " + online,
          value: "Offline: " + offline
        },
      ],
    },
  ];

  //Stringify the embeds using JSON.stringify()
  let data = JSON.stringify({ embeds });

  //Create a config object for axios, you can also use axios.post("url", data) instead
  var config = {
    method: "POST",
    url: urlDiscordWebhook,
    headers: { "Content-Type": "application/json" },
    data: data,
  };

  //Send the request
  axios(config)
    .then((response: any) => {
      console.log("Webhook delivered successfully");
      return response;
    })
    .catch((error: any) => {
      console.log(error);
      return error;
    });
}


function gerarNumeroAleatorio(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


async function estornar(id: string) {
  const url = `https://api.mercadopago.com/v1/payments/${id}/refunds`;

  try {

    const response = await axios.post(url, {}, {
      headers: {
        'Authorization': `Bearer ${process.env.TOKEN_DE_SUA_CONTA_MP}`,
        'X-Idempotency-Key': `${gerarNumeroAleatorio()}`,
      },
    });

    console.log("estorno da operação: " + id + " efetuado com sucesso!")

    return response.data;

  } catch (error) {

    console.log("houve um erro ao tentar efetuar o estorno da operação: " + id);
    console.log("detalhes do erro: " + error)

  }
}

function esconderString(string: string) {
  const tamanho = string.length;
  let resultado = '';

  for (let i = 0; i < tamanho - 3; i++) {
    resultado += '*';
  }

  resultado += string.substring(tamanho - 3, tamanho);
  return resultado;
}




let numTentativasEstorno = 1;
let idempotencyKeyAnterior = "";

function gerarChaveIdempotente() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let chave = '';

  for (let i = 0; i < 32; i++) {
    chave += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }

  return chave;
}

async function estornarMP(id: string, token: string, motivoEstorno: string, tamanhoChave = 32) {
  const url = `https://api.mercadopago.com/v1/payments/${id}/refunds`;

  try {
    console.log('********* estornando *****************');
    console.log(`********* Tentativa nª ${numTentativasEstorno} *****************`);
    console.log(id);
    console.log('********* token *****************');
    console.log(esconderString(token));

    let idempotencyKey = gerarChaveIdempotente();

    // Efetuando o estorno
    const response = await axios.post(url, {}, {
      headers: {
        'X-Idempotency-Key': idempotencyKey,
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(response.data);
    console.log("Estorno da operação: " + id + " efetuado com sucesso!")
    numTentativasEstorno = 1;

    // Se a solicitação for bem-sucedida, salve o valor do cabeçalho X-Idempotency-Key para uso futuro
    idempotencyKeyAnterior = response.headers['x-idempotency-key'];

    return response.data;

  } catch (error) {

    console.log("Houve um erro ao tentar efetuar o estorno da operação: " + id);
    console.log("Detalhes do erro: " + error);

    numTentativasEstorno++;

    if (numTentativasEstorno < 20) { // LIMITE DE TENTATIVAS DE ESTORNO
      await estornarMP(id, token, motivoEstorno, tamanhoChave);
    } else {
      console.log("Após 20 tentativas não conseguimos efetuar o estorno, VERIFIQUE O TOKEN DO CLIENTE!!");
      numTentativasEstorno = 1;

    }

  }
}





//variáveis de controle

var valorDoPixMaquina01 = 0;
var ultimoAcessoMaquina01 = new Date('2023-10-20T17:30:10');

//rotas de consulta

app.get("/consulta-maquina01", async (req, res) => {
  var pulsosFormatados = converterPixRecebido(valorDoPixMaquina01); //<<<<<<ALTERAR 

  valorDoPixMaquina01 = 0; //<<<<<<<<<ALTERAR 

  ultimoAcessoMaquina01 = new Date(); //<<<<<<<<<ALTERAR 

  if (pulsosFormatados != "0000") {
    return res.status(200).json({ "retorno": pulsosFormatados });
  } else {
    return res.status(200).json({ "retorno": "0000" });
  }
});

//notitica em um canal do discord
app.get("/online", async (req, res) => {

  var maquinasOffline = "";
  var maquinasOnline = "";

  //Relação das Máquinas que você tem:

  if (tempoOffline(ultimoAcessoMaquina01) >= 1) {
    maquinasOffline += " Máquina 1";
  } else {
    maquinasOnline += " Máquina 1"
  }

  //caso queira enviar notificações usando o discord crie uma sala de texto e copie o webhook url para cá:
  var urlDoWebhookNoDiscord = "https://discord.com/api/webhooks/1165681639930732544/V3TrmmGnyx11OtyHxotSv31L1t6ASC_eF6NOk_1AmhD";

  if (maquinasOffline != "") {
    notificar(urlDoWebhookNoDiscord, maquinasOnline, maquinasOffline);
  }

  return res.status(200).json({ "Máquina 01": "Sucesso" });

});

app.get("/monitoramento-html", async (req, res) => {

  // Construir a tabela em HTML com CSS embutido
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Monitoramento das Máquinas</title>
    <style>
      table {
        width: 50%;
        border-collapse: collapse;
        margin: 0 auto; /* Centralizar a tabela */
      }
      th, td {
        border: 1px solid #000;
        padding: 10px;
        text-align: center; /* Centralizar o texto */
      }
      th {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      /* Estilo para aumentar o tamanho da fonte */
      td, th {
        font-size: 18px;
      }
    </style>
    <script>
    // Função para atualizar a página a cada 15 segundos
    function atualizarPagina() {
       location.reload();
    }

    // Configura o temporizador para chamar a função a cada 5 segundos (15000 milissegundos)
    setInterval(atualizarPagina, 5000);
   </script>
  </head>
  <body>
    <table>
      <tr>
        <th>Máquina</th>
        <th>Status</th>
      </tr>
      
        <tr>
          <td>Máquina 01</td>
          <td>${tempoOffline(ultimoAcessoMaquina01) >= 10 ? '<b>OFFLINE********</b> ' : 'ONLINE'}</td>
        </tr>
      
    </table>
  </body>
  </html>
`;

  // Enviar a resposta como HTML.
  res.send(html);
});


app.get("/consulta-pix-efi-maq-batom-01", async (req, res) => {
  var pulsosFormatados = converterPixRecebido(valordoPixMaquinaBatomEfi01); //<<<<<<ALTERAR PARA O NUMERO DA MAQUINA

  valordoPixMaquinaBatomEfi01 = 0; //<<<<<<<<<ALTERAR PARA O NUMERO DA MAQUINA

  if (pulsosFormatados != "0000") {
    return res.status(200).json({ "retorno": pulsosFormatados });
  } else {
    return res.status(200).json({ "retorno": "0000" });
  }
});



function converterPixRecebidoMercadoPago(valorPix: number) {
  var valor = ("0000000" + valorPix).slice(-7);
  return valor;
}

app.get("/consulta-pix-mp-maq-plaquinha-01", async (req, res) => {
  var aux = converterPixRecebidoMercadoPago(valordoPixPlaquinhaPixMP);
  valordoPixPlaquinhaPixMP = 0;
  ultimoAcessoMaquina01 = new Date(); //<<<<<<<<<ALTERAffR 
  return res.status(200).json({ "R$: ": aux });
});//.



app.post("/rota-recebimento", async (req, res) => {
  try {
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("ip");
    console.log(ip);
    var qy = req.query.hmac;
    console.log("query");
    console.log(qy);

    if (ip != '34.193.116.226') {
      return res.status(401).json({ "unauthorized": "unauthorized" });
    }


    if (qy != 'myhash1234' && qy != 'myhash1234/pix') {
      return res.status(401).json({ "unauthorized": "unauthorized" });
    }

    console.log("Novo chamada a essa rota detectada:");
    console.log(req.body);

    if (req.body.pix) {

      console.log("valor do pix recebido:");
      console.log(req.body.pix[0].valor);

      if (req.body.pix) {

        if (req.body.pix[0].txid == "70a8cacb59b53eac8ccb") {
          valordoPixMaquinaBatomEfi01 = req.body.pix[0].valor;
          console.log("Creditando valor do pix na máquina de Batom 01");
        }


      }
    }
  } catch (error) {
    console.error(error);
    return res.status(402).json({ "error": "error: " + error });
  }
  return res.status(200).json({ "ok": "ok" });
});


app.post("/rota-recebimento-teste", async (req, res) => {
  try {
    console.log("Novo pix detectado:");
    console.log(req.body);

    console.log("valor:");
    console.log(req.body.valor);
    console.log("txid:");
    console.log(req.body.txid);

    var txid = req.body.txid;
    if (txid == "flaksdfjaskldfjadfasdfccc") {
      valordoPixMaquinaBatomEfi01 = req.body.valor;
      console.log("setado valor pix para:" + req.body.valor);
    }


    console.log(req.body.valor);
  } catch (error) {
    console.error(error);
    return res.status(402).json({ "error": "error: " + error });
  }
  return res.status(200).json({ "mensagem": "ok" });
});



app.post("/rota-recebimento-mercado-pago", async (req: any, res: any) => {
  try {
    console.log("Novo pix do Mercado Pago:");
    console.log(req.body);

    console.log("id");
    console.log(req.query.id);

    var url = "https://api.mercadopago.com/v1/payments/" + req.query.id;

    axios.get(url)
      .then((response: { data: { store_id: string; transaction_amount: number; status: string }; }) => {
        //console.log('Response', response.data)
        if (response.data.status != "approved") {
          console.log("pagamento não aprovado!");
          return;
        }

        console.log('store_id', response.data.store_id);
        console.log('storetransaction_amount_id', response.data.transaction_amount);

        //creditar de acordo com o sttore_id (um para cada maq diferente)
        if (response.data.store_id == '56155276') {
          if (tempoOffline(ultimoAcessoMaquina01) >= 10) {
            console.log("Efetuando estorno - Máquina Offline!")
            estornar(req.query.id);
          } else {
            console.log("Creditando pix na máquina 1. store_id(56155276)")
            valorDoPixMaquina01 = response.data.transaction_amount;
            valordoPixPlaquinhaPixMP = response.data.transaction_amount;
          }
        }

      })
  } catch (error) {
    console.error(error);
    return res.status(402).json({ "error": "error: " + error });
  }
  return res.status(200).json({ "mensagem": "ok" });
});



//fim integração pix V2


//rotas integração pix  v3
//CADASTRO DE ADMINISTRADOR ADM
//app.post("/pessoa", async (req, res) => {
//try {
  //const salt = await bcrypt.genSalt(10);
  // req.body.senha = await bcrypt.hash(req.body.senha, salt);
 //  req.body.dataInclusao = new Date(Date.now());

 // const pessoa = await prisma.pix_Pessoa.create({ data: req.body });

  // pessoa.senha = "";

  // return res.json(pessoa);
// } catch (err: any) {
  //  console.log(err);
 //   return res.status(500).json({ error: `>>:${err.message}` });
 //}
//});

//iniciar v4
app.post("/config", async (req, res) => {
  try {

   //  console.log(req.body);
    //return res.status(200).json({ msg: "Cadastro efetuado com sucesso! Acesse o painel ADM V4" });


    const p = await prisma.pix_Pessoa.findFirst();

    if (p) {
      return res.status(500).json({ error: `Já existe adm cadastrado!` });
    } else {
      const salt = await bcrypt.genSalt(10);
      req.body.senha = await bcrypt.hash(req.body.senha, salt);
      // req.body.dataInclusao = new Date(Date.now());

      const pessoa = await prisma.pix_Pessoa.create({ data: req.body });

      pessoa.senha = "";

      return res.status(200).json({ msg: "Cadastro efetuado com sucesso! Acesse o painel ADM V4" });

    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});


app.post("/cliente", verifyJwtPessoa, async (req: any, res) => {

  try {
    const salt = await bcrypt.genSalt(10);

    req.body.senha = await bcrypt.hash(req.body.senha, salt);

    req.body.pessoaId = req.userId;

    const cliente = await prisma.pix_Cliente.create({ data: req.body });

    cliente.senha = "";

    return res.json(cliente);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});

app.put("/cliente", verifyJwtPessoa, async (req: any, res) => {

  try {


    req.body.pessoaId = req.userId;

    var clienteAtualizado = await prisma.pix_Cliente.update({
      where: {
        id: req.body.id,
      },
      data:
      {
        nome: req.body.nome,
        mercadoPagoToken: req.body.mercadoPagoToken,
        dataVencimento: req.body.dataVencimento
      },
      select: {
        id: true,
        nome: true,
        mercadoPagoToken: false,
        dataVencimento: true
        // Adicione outros campos conforme necessário
      },
    });


    return res.json(clienteAtualizado);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});

app.delete('/cliente/:id', verifyJwtPessoa, async (req, res) => {
  const clienteId = req.params.id;

  try {
    // Verificar se o cliente existe
    const cliente = await prisma.pix_Cliente.findUnique({
      where: {
        id: clienteId,
      },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Excluir o cliente
    await prisma.pix_Cliente.delete({
      where: {
        id: clienteId,
      },
    });

    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir o cliente:', error);
    res.status(500).json({ error: 'Erro ao excluir o cliente' });
  }
});


app.put('/alterar-cliente-adm-new/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, mercadoPagoToken, dataVencimento } = req.body;

  try {
    // Atualiza o cliente no banco de dados
    const updatedCliente = await prisma.pix_Cliente.update({
      where: { id },
      data: {
        nome,
        mercadoPagoToken,
        dataVencimento,
      },
    });

    // Protege o campo mercadoPagoToken
    const protectedCliente = { ...updatedCliente };
    if (protectedCliente.mercadoPagoToken) {
      protectedCliente.mercadoPagoToken = protectedCliente.mercadoPagoToken.slice(-3).padStart(protectedCliente.mercadoPagoToken.length, '*');
    }

    if (protectedCliente.senha) {
      protectedCliente.senha = '***'; // Substitua por uma string de sua escolha
    }


    res.json(protectedCliente);
  } catch (error) {
    console.error('Erro ao alterar o cliente:', error);
    res.status(500).json({ "message": 'Erro ao alterar o cliente' });
  }
});



app.put("/cliente-sem-token", verifyJwtPessoa, async (req: any, res) => {

  try {


    req.body.pessoaId = req.userId;

    var clienteAtualizado = await prisma.pix_Cliente.update({
      where: {
        id: req.body.id,
      },
      data:
      {
        nome: req.body.nome,
        dataVencimento: req.body.dataVencimento
      },
      select: {
        id: true,
        nome: true,
        mercadoPagoToken: false,
        dataVencimento: true
        // Adicione outros campos conforme necessário
      },
    });


    return res.json(clienteAtualizado);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});

function criarSenha() {
  const caracteres = '0123456789abcdefghijklmnopqrstuvwxyz';
  let textoAleatorio = '';

  for (let i = 0; i < 8; i++) {
    const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
    textoAleatorio += caracteres.charAt(indiceAleatorio);
  }

  return textoAleatorio;
}

app.put("/cliente-trocar-senha", verifyJwtPessoa, async (req: any, res) => {

  var novaSenha = "";
  var senhaCriptografada = "";

  try {

    novaSenha = criarSenha();

    const salt = await bcrypt.genSalt(10);

    senhaCriptografada = await bcrypt.hash(novaSenha, salt);

    const clienteAtualizado = await prisma.pix_Cliente.update({
      where: { email: req.body.email },
      data: { senha: senhaCriptografada },
    });

    if (clienteAtualizado) {
      return res.json({ "newPassword": novaSenha });
    } else {
      return res.status(301).json({ error: `>>:cliente não encontrado` });
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>:cliente não encontrado` });
  }
});

// //TROCAR SENHA ADM LOGADO
// app.put("/trocar-senha-adm", verifyJwtPessoa, async (req: any, res) => {

//   var novaSenha = "";
//   var senhaCriptografada = "";

//   try {

//     novaSenha = criarSenha();

//     const salt = await bcrypt.genSalt(10);

//     senhaCriptografada = await bcrypt.hash(novaSenha, salt);

//     const clienteAtualizado = await prisma.pix_Pessoa.update({
//       where: { email: req.body.email },
//       data: { senha: senhaCriptografada },
//     });

//     if (clienteAtualizado) {
//       return res.json({ "newPassword": novaSenha });
//     } else {
//       return res.status(301).json({ "message": `>>:adm não encontrado` });
//     }

//   } catch (err: any) {
//     console.log(err);
//     return res.status(500).json({ "message": `>:adm não encontrado` });
//   }
// });

//cadastrar nova máquina adm
app.post("/maquina", verifyJwtPessoa, async (req: any, res) => {
  try {
    req.body.pessoaId = req.userId;

    // Verifique se já existe uma máquina com o mesmo nome para esse cliente
    const maquinaExistente = await prisma.pix_Maquina.findFirst({
      where: {
        nome: req.body.nome,
        clienteId: req.body.clienteId
      },
    });

    if (maquinaExistente) {
      return res.status(400).json({ error: "Já existe uma máquina com esse nome para este cliente." });
    }


    const maquina = await prisma.pix_Maquina.create({ data: req.body });

    return res.json(maquina);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});


app.put('/recuperar-id-maquina/:id', verifyJwtPessoa, async (req, res) => {
  const { id } = req.params;
  const { novoId } = req.body;

  try {
    // Verifica se a máquina com o ID atual existe
    const maquinaExistente = await prisma.pix_Maquina.findUnique({
      where: { id },
    });

    if (!maquinaExistente) {
      return res.status(404).json({ error: 'Máquina não encontrada' });
    }

    // Atualiza o ID da máquina
    const maquinaAtualizada = await prisma.pix_Maquina.update({
      where: { id },
      data: { id: novoId },
    });

    res.json({ message: 'ID da máquina atualizado com sucesso', maquina: maquinaAtualizada });
  } catch (error) {
    console.error('Erro ao alterar o ID da máquina:', error);
    res.status(500).json({ error: 'Erro ao alterar o ID da máquina' });
  }
});

//cadastrar nova máquina CLIENTE
app.post("/maquina-cliente", verifyJWT, async (req: any, res) => {

  try {
    //console.log(req.userId);

    const { nome, descricao, valorDoPix, valorDoPulso, store_id } = req.body;


    const pixCliente = await prisma.pix_Cliente.findFirst({
      where: {
        id: req.userId,
      },
    });

    const clienteId = req.userId;

    const pessoaId = pixCliente?.pessoaId;

    // Verifique se já existe uma máquina com o mesmo nome para esse cliente
    const maquinaExistente = await prisma.pix_Maquina.findFirst({
      where: {
        nome,
        clienteId: req.userId,
      },
    });

    if (maquinaExistente) {
      return res.status(400).json({ error: "Já existe uma máquina com esse nome para este cliente." });
    }

    // Insira a nova máquina no banco de dados
    const maquina = await prisma.pix_Maquina.create({
      data: {
        nome,
        descricao,
        valorDoPix,
        valorDoPulso,
        clienteId,
        store_id,
        pessoaId
      }
    });

    return res.json(maquina);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }

  //return res.status(401).json({ error: `>>:não autorizado!` });
});

//alterar máquina
app.put("/maquina", verifyJwtPessoa, async (req: any, res) => {
  try {
    const maquinaAtualizada = await prisma.pix_Maquina.update({
      where: {
        id: req.body.id,
      },
      data: {
        // Substitua os valores abaixo pelos novos valores que você deseja atribuir
        nome: req.body.nome,
        descricao: req.body.descricao,
        store_id: req.body.store_id,
        valorDoPulso: req.body.valorDoPulso,
        probabilidade: req.body.probabilidade,
        garraforte: req.body.garraforte,
        contadorcredito: req.body.contadorcredito,
        contadorpelucia: req.body.contadorpelucia,
        estoque: req.body.estoque,
        estoque2: req.body.estoque2,
        estoque3: req.body.estoque3,
        estoque4: req.body.estoque4,
        estoque5: req.body.estoque5
        // Adicione outros campos conforme necessário
      },
    });

    console.log('Máquina atualizada com sucesso:', maquinaAtualizada);

    return res.status(200).json(maquinaAtualizada);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});

//alterar máquina CLIENTE
app.put("/maquina-cliente", verifyJWT, async (req: any, res) => {
  try {
    const maquinaAtualizada = await prisma.pix_Maquina.update({
      where: {
        id: req.body.id,
      },
      data: {
        // Substitua os valores abaixo pelos novos valores que você deseja atribuir
        nome: req.body.nome,
        descricao: req.body.descricao,
        store_id: req.body.store_id,
        valorDoPulso: req.body.valorDoPulso,
        probabilidade: req.body.probabilidade,
        garraforte: req.body.garraforte,
        contadorcredito: req.body.contadorcredito,
        contadorpelucia: req.body.contadorpelucia,
        estoque: req.body.estoque,
        estoque2: req.body.estoque2,
        estoque3: req.body.estoque3,
        estoque4: req.body.estoque4,
        estoque5: req.body.estoque5
        // Adicione outros campos conforme necessário
      },
    });

    console.log('Máquina atualizada com sucesso:', maquinaAtualizada);

    return res.status(200).json(maquinaAtualizada);
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});

//DELETAR MÁQUINA....
app.delete("/maquina", verifyJwtPessoa, async (req: any, res) => {
  try {

    if (!req.body.id) {
      return res.status(500).json({ error: `>>:informe o id da máquina que deseja deletar` });
    }

    const deletedPagamento = await prisma.pix_Pagamento.deleteMany({
      where: {
        maquinaId: req.body.id,
      },
    });

    const deletedMaquina = await prisma.pix_Maquina.delete({
      where: {
        id: req.body.id,
      },
    });

    if (deletedMaquina) {
      console.log('Máquina removida com sucesso:', deletedMaquina.nome);
      return res.status(200).json(`Máquina: ${deletedMaquina.nome} removida.`);
    } else {
      return res.status(200).json(`Máquina não encontrada.`);
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});

//DELETAR MÁQUINA....
app.delete("/maquina-cliente", verifyJWT, async (req: any, res) => {
  try {

    if (!req.body.id) {
      return res.status(500).json({ error: `>>:informe o id da máquina que deseja deletar` });
    }

    const deletedPagamento = await prisma.pix_Pagamento.deleteMany({
      where: {
        maquinaId: req.body.id,
      },
    });

    const deletedMaquina = await prisma.pix_Maquina.delete({
      where: {
        id: req.body.id,
      },
    });

    if (deletedMaquina) {
      console.log('Máquina removida com sucesso:', deletedMaquina.nome);
      return res.status(200).json(`Máquina: ${deletedMaquina.nome} removida.`);
    } else {
      return res.status(200).json(`Máquina não encontrada.`);
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ error: `>>:${err.message}` });
  }
});


app.get("/consultar-maquina/:id", async (req: any, res) => {
  //console.log(`${req.userId} acessou a dashboard.`);

  try {

    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      }
    });

    var pulsosFormatados = "";

    if (maquina != null) {
      pulsosFormatados = converterPixRecebidoDinamico(parseFloat(maquina.valorDoPix), parseFloat(maquina.valorDoPulso));

      console.log("encontrou"); //zerar o valor e atualizar data ultimo acesso

      await prisma.pix_Maquina.update({
        where: {
          id: req.params.id
        },
        data: {
          valorDoPix: "0",
          ultimaRequisicao: new Date(Date.now())
        }
      })

    } else {
      pulsosFormatados = "0000";
      console.log("não encontrou");
    }

    return res.status(200).json({ "retorno": pulsosFormatados });

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "0000" });
  }
});

//SIMULA UM CRÉDITO REMOTO
app.post("/credito-remoto", verifyJwtPessoa, async (req: any, res) => {

  try {

    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.body.id,
      },
      include: {
        cliente: true,
      },
    });

    //VERIFICANDO SE A MÁQUINA PERTENCE A UM CIENTE ATIVO 
    if (maquina != null) {
      if (maquina.cliente !== null && maquina.cliente !== undefined) {
        if (maquina.cliente.ativo) {
          console.log("Cliente ativo - seguindo...");
        } else {
          console.log("Cliente inativo - parando...");
          return res.status(500).json({ "retorno": `CLIENTE ${maquina.cliente.nome} INATIVO` });
        }
      } else {
        console.log("error.. cliente nulo!");
      }

      //VERIFICAR SE A MAQUINA ESTA ONINE
      if (maquina.ultimaRequisicao) {
        var status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 60 ? "OFFLINE" : "ONLINE";
        console.log(status);
        if (status == "OFFLINE") {
          return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
        }
      } else {
        return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
      }

      await prisma.pix_Maquina.update({
        where: {
          id: req.body.id
        },
        data: {
          valorDoPix: req.body.valor,
          ultimoPagamentoRecebido: new Date(Date.now())
        }
      });

      return res.status(200).json({ "retorno": "SUCESSO!" });

    } else {
      console.log("não encontrou");
      return res.status(301).json({ "retorno": "ID NÃO ENCONTRADO" });
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO: see: console > view logs" });
  }
});

//SIMULA UM CRÉDITO REMOTO
app.post("/credito-remoto-cliente", verifyJWT, async (req: any, res) => {

  try {

    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.body.id,
      },
      include: {
        cliente: true,
      },
    });


    //VERIFICANDO SE A MÁQUINA PERTENCE A UM CIENTE ATIVO 
    if (maquina != null) {
      if (maquina.cliente !== null && maquina.cliente !== undefined) {
        if (maquina.cliente.ativo) {
          console.log("Cliente ativo - seguindo...");
        } else {
          console.log("Cliente inativo - parando...");
          return res.status(500).json({ "retorno": `CLIENTE ${maquina.cliente.nome} INATIVO` });
        }
      } else {
        console.log("error.. cliente nulo!");
      }

      //VERIFICAR SE A MAQUINA ESTA ONINE
      if (maquina.ultimaRequisicao) {
        var status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 60 ? "OFFLINE" : "ONLINE";
        console.log(status);
        if (status == "OFFLINE") {
          return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
        }
      } else {
        return res.status(400).json({ "msg": "MÁQUINA OFFLINE!" });
      }


      await prisma.pix_Maquina.update({
        where: {
          id: req.body.id
        },
        data: {
          valorDoPix: req.body.valor,
          ultimoPagamentoRecebido: new Date(Date.now())
        }
      });

      return res.status(200).json({ "retorno": "SUCESSO!" });

    } else {
      console.log("não encontrou");
      return res.status(301).json({ "retorno": "ID NÃO ENCONTRADO" });
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO: see: console > view logs" });
  }
});

//login ADM 
app.post("/login-pessoa", async (req, res) => {
  try {
    const user = await prisma.pix_Pessoa.findUnique({
      where: {
        email: req.body.email
      },
    })

    if (!user) {
      throw new Error('Password or Email Invalid');
    }

    // check user password with hashed password stored in the database
    const validPassword = await bcrypt.compare(req.body.senha, user.senha);

    if (!validPassword) {
      throw new Error('Password or Email Invalid');
    }

    await prisma.pix_Pessoa.update({
      where: {
        email: req.body.email
      },
      data: { ultimoAcesso: new Date(Date.now()) }
    })

    //explicação top sobre jwt https://www.youtube.com/watch?v=D0gpL8-DVrc
    const token = jwt.sign({ userId: user.id }, SECRET_PESSOA, { expiresIn: 3600 }); //5min = 300 para 1h = 3600

    return res.json({ email: user.email, id: user.id, type: "pessoa", key: "ADMIN", name: user.nome, lastLogin: user.ultimoAcesso, token });
  } catch (error) {

    const { message } = error as Error;

    return res.status(403).json({ error: message });
  }
});
//

//login-cliente
app.post("/login-cliente", async (req, res) => {
  try {
    const user = await prisma.pix_Cliente.findUnique({
      where: {
        email: req.body.email
      },
    })

    if (!user) {
      throw new Error('Password or Email Invalid');
    }

    // check user password with hashed password stored in the database
    const validPassword = await bcrypt.compare(req.body.senha, user.senha);

    if (!validPassword) {
      throw new Error('Password or Email Invalid');
    }

    await prisma.pix_Cliente.update({
      where: {
        email: req.body.email
      },
      data: { ultimoAcesso: new Date(Date.now()) }
    })

    //explicação top sobre jwt https://www.youtube.com/watch?v=D0gpL8-DVrc
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: 3600 }); //5min = 300 para 1h = 3600

    var warningMsg = "";

    if (user) {
      if (user.dataVencimento) {
        const diferencaEmMilissegundos = new Date().getTime() - user.dataVencimento.getTime();
        const diferencaEmDias = Math.floor(diferencaEmMilissegundos / (1000 * 60 * 60 * 24));
        console.log("atraso: " + diferencaEmDias);
        if (diferencaEmDias > 0 && diferencaEmDias <= 5) {
          warningMsg = `Atenção! Regularize seu pagamento!`
        }
        if (diferencaEmDias > 5 && diferencaEmDias <= 10) {
          warningMsg = `seu plano será bloqueado em  ${diferencaEmDias} dia(s), efetue pagamento e evite o bloqueio.`
        }
        if (diferencaEmDias > 10) {
          warningMsg = `seu plano está bloqueado, entre em contato com o setor financeiro!`
        }
      }
    }

    return res.json({ email: user.email, id: user.id, type: "pessoa", key: "CLIENT", name: user.nome, lastLogin: user.ultimoAcesso, ativo: user.ativo, warningMsg: warningMsg, vencimento: user.dataVencimento, token });
  } catch (error) {

    const { message } = error as Error;

    return res.status(403).json({ error: message });
  }
});


//maquinas exibir as máquinas de um cliente logado
app.get("/maquinas", verifyJWT, async (req: any, res) => {

  console.log(`${req.userId} acessou a rota que busca todos as máquinas.`);

  try {

    const maquinas = await prisma.pix_Maquina.findMany({
      where: {
        clienteId: req.userId,
      },
      orderBy: {
        dataInclusao: 'desc', // 'asc' para ordenação ascendente, 'desc' para ordenação descendente.
      },
    });

    if (maquinas != null) {
      console.log("encontrou");

      const maquinasComStatus = [];

      for (const maquina of maquinas) {
        // 60 segundos sem acesso máquina já fica offline
        if (maquina.ultimaRequisicao) {
          var status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 60 ? "OFFLINE" : "ONLINE";

          //60 segundos x 30 = 1800 segundos (meia hora pagamento mais recente)
          if (status == "ONLINE" && maquina.ultimoPagamentoRecebido && tempoOffline(new Date(maquina.ultimoPagamentoRecebido)) < 1800) {
            status = "PAGAMENTO_RECENTE";
          }

          maquinasComStatus.push({
            id: maquina.id,
            pessoaId: maquina.pessoaId,
            clienteId: maquina.clienteId,
            nome: maquina.nome,
            descricao: maquina.descricao,
            probabilidade: maquina.probabilidade,
            garraforte: maquina.garraforte,
            contadorcredito: maquina.contadorcredito,
            contadorpelucia: maquina.contadorpelucia,
            estoque: maquina.estoque,
            estoque2: maquina.estoque2,
            estoque3: maquina.estoque3,
            estoque4: maquina.estoque4,
            estoque5: maquina.estoque5,
            store_id: maquina.store_id,
            valorDoPix: maquina.valorDoPix,
            dataInclusao: maquina.dataInclusao,
            ultimoPagamentoRecebido: maquina.ultimoPagamentoRecebido,
            ultimaRequisicao: maquina.ultimaRequisicao,
            status: status,
            pulso: maquina.valorDoPulso
          });
        } else {
          maquinasComStatus.push({
            id: maquina.id,
            pessoaId: maquina.pessoaId,
            clienteId: maquina.clienteId,
            nome: maquina.nome,
            descricao: maquina.descricao,
            probabilidade: maquina.probabilidade,
            garraforte: maquina.garraforte,
            contadorcredito: maquina.contadorcredito,
            contadorpelucia: maquina.contadorpelucia,
            estoque: maquina.estoque,
            estoque2: maquina.estoque2,
            estoque3: maquina.estoque3,
            estoque4: maquina.estoque4,
            estoque5: maquina.estoque5,
            store_id: maquina.store_id,
            valorDoPix: maquina.valorDoPix,
            dataInclusao: maquina.dataInclusao,
            ultimoPagamentoRecebido: maquina.ultimoPagamentoRecebido,
            ultimaRequisicao: maquina.ultimaRequisicao,
            status: "OFFLINE",
            pulso: maquina.valorDoPulso
          });
        }
      }

      return res.status(200).json(maquinasComStatus);

    } else {
      console.log("não encontrou");
      return res.status(200).json("[]");
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});


app.get("/maquinas-adm", verifyJwtPessoa, async (req: any, res) => {

  try {

    const maquinas = await prisma.pix_Maquina.findMany({
      where: {
        clienteId: req.query.id,
      },
      orderBy: {
        dataInclusao: 'desc', // 'asc' para ordenação ascendente, 'desc' para ordenação descendente.
      },
    });

    if (maquinas != null) {
      console.log("encontrou");

      const maquinasComStatus = [];

      for (const maquina of maquinas) {
        // 60 segundos sem acesso máquina já fica offline
        if (maquina.ultimaRequisicao) {
          var status = (tempoOffline(new Date(maquina.ultimaRequisicao))) > 60 ? "OFFLINE" : "ONLINE";

          //60 segundos x 30 = 1800 segundos (meia hora pagamento mais recente)
          if (status == "ONLINE" && maquina.ultimoPagamentoRecebido && tempoOffline(new Date(maquina.ultimoPagamentoRecebido)) < 1800) {
            status = "PAGAMENTO_RECENTE";
          }

          maquinasComStatus.push({
            id: maquina.id,
            pessoaId: maquina.pessoaId,
            clienteId: maquina.clienteId,
            nome: maquina.nome,
            descricao: maquina.descricao,
            probabilidade: maquina.probabilidade,
            garraforte: maquina.garraforte,
            contadorcredito: maquina.contadorcredito,
            contadorpelucia: maquina.contadorpelucia,
            estoque: maquina.estoque,
            estoque2: maquina.estoque2,
            estoque3: maquina.estoque3,
            estoque4: maquina.estoque4,
            estoque5: maquina.estoque5,
            store_id: maquina.store_id,
            valorDoPix: maquina.valorDoPix,
            dataInclusao: maquina.dataInclusao,
            ultimoPagamentoRecebido: maquina.ultimoPagamentoRecebido,
            ultimaRequisicao: maquina.ultimaRequisicao,
            status: status,
            pulso: maquina.valorDoPulso
          });
        } else {
          maquinasComStatus.push({
            id: maquina.id,
            pessoaId: maquina.pessoaId,
            clienteId: maquina.clienteId,
            nome: maquina.nome,
            descricao: maquina.descricao,
            probabilidade: maquina.probabilidade,
            garraforte: maquina.garraforte,
            contadorcredito: maquina.contadorcredito,
            contadorpelucia: maquina.contadorpelucia,
            estoque: maquina.estoque,
            estoque2: maquina.estoque2,
            estoque3: maquina.estoque3,
            estoque4: maquina.estoque4,
            estoque5: maquina.estoque5,
            store_id: maquina.store_id,
            valorDoPix: maquina.valorDoPix,
            dataInclusao: maquina.dataInclusao,
            ultimoPagamentoRecebido: maquina.ultimoPagamentoRecebido,
            ultimaRequisicao: maquina.ultimaRequisicao,
            status: "OFFLINE",
            pulso: maquina.valorDoPulso
          });
        }
      }

      return res.status(200).json(maquinasComStatus);

    } else {
      console.log("não encontrou");
      return res.status(200).json("[]");
    }

  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});

app.get("/clientes", verifyJwtPessoa, async (req: any, res) => {
  console.log(`${req.userId} acessou a rota que busca todos as máquinas.`);
  try {
    const clientesComMaquinas = await prisma.pix_Cliente.findMany({
      where: {
        pessoaId: req.userId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        dataInclusao: true,
        ultimoAcesso: true,
        ativo: true,
        senha: false,
        mercadoPagoToken: true,
        dataVencimento: true,
        Maquina: {
          select: {
            id: true,
            nome: true,
            descricao: true,
            store_id: true,
            dataInclusao: true,
            ultimoPagamentoRecebido: true,
            ultimaRequisicao: true,
          },
        },
      },
      orderBy: {
        dataInclusao: 'desc', // Ordenar pela dataInclusao do mais atual para o mais antigo
      },
    });

    if (clientesComMaquinas != null) {
      console.log("retornando a lista de clientes e suas respectivas máquinas");
      // Modificando o campo mercadoPagoToken
      const clientesModificados = clientesComMaquinas.map(cliente => ({
        ...cliente,
        mercadoPagoToken: cliente.mercadoPagoToken ? "***********" + cliente.mercadoPagoToken.slice(-3) : null,
      }));
      return res.status(200).json(clientesModificados);
    } else {
      console.log("não encontrou");
      return res.status(200).json("[]");
    }
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});

app.post("/ativar-cliente", verifyJwtPessoa, async (req, res) => {
  try {
    const cliente = await prisma.pix_Cliente.findUnique({
      where: {
        id: req.body.clienteId
      },
    })

    if (!cliente) {
      throw new Error('Client not found');
    }

    await prisma.pix_Cliente.update({
      where: {
        id: req.body.clienteId
      },
      data: {
        ativo: true
      }
    });

    return res.status(200).json({ "retorno": `CLIENTE ${cliente.nome} DESBLOQUEADO` });
  } catch (error) {

    const { message } = error as Error;

    return res.status(403).json({ error: message });
  }
});

app.post("/inativar-cliente", verifyJwtPessoa, async (req, res) => {
  try {
    const cliente = await prisma.pix_Cliente.findUnique({
      where: {
        id: req.body.clienteId
      },
    })

    if (!cliente) {
      throw new Error('Client not found');
    }

    await prisma.pix_Cliente.update({
      where: {
        id: req.body.clienteId
      },
      data: {
        ativo: false
      }
    });

    return res.status(200).json({ "retorno": `CLIENTE ${cliente.nome} BLOQUEADO` });
  } catch (error) {

    const { message } = error as Error;

    return res.status(403).json({ error: message });
  }
});

async function verificarRegistroExistente(mercadoPagoId: string, maquinaId: string) {
  try {
    // Verificar se já existe um registro com os campos especificados
    const registroExistente = await prisma.pix_Pagamento.findFirst({
      where: {
        mercadoPagoId: mercadoPagoId,
        maquinaId: maquinaId,
      },
    });

    if (registroExistente) {
      // Se um registro com os campos especificados existe, retorna true
      return true;
    } else {
      // Se não existir nenhum registro com os campos especificados, retorna false
      return false;
    }
  } catch (error) {
    console.error('Erro ao verificar o registro:', error);
    throw new Error('Erro ao verificar o registro.');
  }
}


//exemplo: https://seuservidorheroku.com/rota-recebimento-mercado-pago-dinamica/ID_DO_Clientea803e2f8-7045-4ae8
app.post("/rota-recebimento-mercado-pago-dinamica/:id", async (req: any, res: any) => {

  try {

    //teste de chamada do Mercado Pago
    if (req.query.id === "123456") {
      return res.status(200).json({ "status": "ok" });
    }

    var valor = 0.00;
    var tipoPagamento = ``;
    var taxaDaOperacao = ``;
    var cliId = ``;
    var str_id = "";
    var mensagem = `MÁQUINA NÃO POSSUI store_id CADASTRADO > 
    ALTERE O store_id dessa máquina para ${str_id} para poder receber pagamentos nela...`;


    console.log("Novo pix do Mercado Pago:");
    console.log(req.body);

    console.log("id");
    console.log(req.query.id);

    var url = "https://api.mercadopago.com/v1/payments/" + req.query.id;

    var tokenCliente = "";

    //buscar token do cliente no banco de dados:
    const cliente = await prisma.pix_Cliente.findUnique({
      where: {
        id: req.params.id,
      }
    });

    tokenCliente = (cliente?.mercadoPagoToken == undefined) ? "" : cliente?.mercadoPagoToken;
    cliId = (cliente?.id == undefined) ? "" : cliente?.id;

    if (tokenCliente) {
      console.log("token obtido.");
    }

    console.log("Cliente ativo:");
    console.log(cliente?.ativo);



    axios.get(url, { headers: { Authorization: `Bearer ${tokenCliente}` } })
      .then(async (response: { data: { store_id: string; transaction_amount: number; status: string, payment_type_id: string, fee_details: any }; }) => {

        console.log('store_id', response.data.store_id);
        str_id = response.data.store_id;
        console.log('storetransaction_amount_id', response.data.transaction_amount);
        console.log('payment_method_id', response.data.payment_type_id);
        valor = response.data.transaction_amount;
        tipoPagamento = response.data.payment_type_id;

        if (response.data.fee_details && Array.isArray(response.data.fee_details) && response.data.fee_details.length > 0) {
          console.log('Amount:', response.data.fee_details[0].amount);
          taxaDaOperacao = response.data.fee_details[0].amount + "";
        }

        //BUSCAR QUAL MÁQUINA ESTÁ SENDO UTILIZADA (store_id)
        const maquina = await prisma.pix_Maquina.findFirst({
          where: {
            store_id: str_id,
            clienteId: req.params.id
          },
          include: {
            cliente: true,
          },
        });

        console.log("store id trazido pelo Mercado Pago...");
        console.log(str_id);



        //PROCESSAR O PAGAMENTO (se eu tiver uma máquina com store_id cadastrado)
        if (maquina && maquina.store_id && maquina.store_id.length > 0) {

          console.log(`recebendo pagamento na máquina: ${maquina.nome} - store_id: ${maquina.store_id}`)

          //VERIFICANDO SE A MÁQUINA PERTENCE A UM CIENTE ATIVO 
          if (cliente != null) {
            if (cliente !== null && cliente !== undefined) {
              if (cliente.ativo) {
                console.log("Cliente ativo - seguindo...");

                //VERIFICAÇÃO DA DATA DE VENCIMENTO:
                if (cliente.dataVencimento) {
                  if (cliente.dataVencimento != null) {
                    console.log("verificando inadimplência...");
                    const dataVencimento: Date = cliente.dataVencimento;
                    const dataAtual = new Date();
                    const diferencaEmMilissegundos = dataAtual.getTime() - dataVencimento.getTime();
                    const diferencaEmDias = Math.floor(diferencaEmMilissegundos / (1000 * 60 * 60 * 24));
                    console.log(diferencaEmDias);
                    if (diferencaEmDias > 10) {
                      console.log("Cliente MENSALIDADE atrasada - estornando...");

                      //EVITAR ESTORNO DUPLICADO
                      const registroExistente = await prisma.pix_Pagamento.findFirst({
                        where: {
                          mercadoPagoId: req.query.id,
                          estornado: true,
                        },
                      });

                      if (registroExistente) {
                        console.log("Esse estorno ja foi feito...");
                        return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                      } else {
                        console.log("Seguindo...");
                      }
                      //FIM EVITANDO ESTORNO DUPLICADO

                      estornarMP(req.query.id, tokenCliente, "mensalidade com atraso");
                      //REGISTRAR O PAGAMENTO
                      const novoPagamento = await prisma.pix_Pagamento.create({
                        data: {
                          maquinaId: maquina.id,
                          valor: valor.toString(),
                          mercadoPagoId: req.query.id,
                          motivoEstorno: `01- mensalidade com atraso. str_id: ${str_id}`,
                          estornado: true,
                        },
                      });
                      return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                    }
                  }
                  else {
                    console.log("pulando etapa de verificar inadimplência... campo dataVencimento não cadastrado ou nulo!")
                  }
                }
                //FIM VERIFICAÇÃO VENCIMENTO

              } else {
                console.log("Cliente inativo - estornando...");

                //EVITAR ESTORNO DUPLICADO
                const registroExistente = await prisma.pix_Pagamento.findFirst({
                  where: {
                    mercadoPagoId: req.query.id,
                    estornado: true,
                  },
                });

                if (registroExistente) {
                  console.log("Esse estorno ja foi feito...");
                  return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
                } else {
                  console.log("Seguindo...");
                }
                //FIM EVITANDO ESTORNO DUPLICADO

                estornarMP(req.query.id, tokenCliente, "cliente inativo");
                //REGISTRAR O PAGAMENTO
                const novoPagamento = await prisma.pix_Pagamento.create({
                  data: {
                    maquinaId: maquina.id,
                    valor: valor.toString(),
                    mercadoPagoId: req.query.id,
                    motivoEstorno: `02- cliente inativo. str_id: ${str_id}`,
                    estornado: true,
                  },
                });
                return res.status(200).json({ "retorno": "error.. cliente INATIVO - pagamento estornado!" });
              }
            } else {
              console.log("error.. cliente nulo ou não encontrado!");
              return res.status(200).json({ "retorno": "error.. cliente nulo ou não encontrado!" });
            }
          }
          //FIM VERIFICAÇÃO DE CLIENTE ATIVO.

          //VERIFICANDO SE A MÁQUINA ESTÁ OFFLINE 
          if (maquina.ultimaRequisicao instanceof Date) {
            const diferencaEmSegundos = tempoOffline(maquina.ultimaRequisicao);
            if (diferencaEmSegundos > 60) {
              console.log("estornando... máquina offline.");

              //EVITAR ESTORNO DUPLICADO
              const registroExistente = await prisma.pix_Pagamento.findFirst({
                where: {
                  mercadoPagoId: req.query.id,
                  estornado: true,
                },
              });

              if (registroExistente) {
                console.log("Esse estorno ja foi feito...");
                return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
              } else {
                console.log("Seguindo...");
              }
              //FIM EVITANDO ESTORNO DUPLICADO

              estornarMP(req.query.id, tokenCliente, "máquina offline");
              //evitando duplicidade de estorno:
              const estornos = await prisma.pix_Pagamento.findMany({
                where: {
                  mercadoPagoId: req.query.id,
                  estornado: true,
                },
              });

              if (estornos) {
                if (estornos.length > 0) {
                  return res.status(200).json({ "retorno": "PAGAMENTO JÁ ESTORNADO! - MÁQUINA OFFLINE" });
                }
              }
              //FIM envitando duplicidade de estor8no
              //REGISTRAR ESTORNO
              const novoPagamento = await prisma.pix_Pagamento.create({
                data: {
                  maquinaId: maquina.id,
                  valor: valor.toString(),
                  mercadoPagoId: req.query.id,
                  motivoEstorno: `03- máquina offline. str_id: ${str_id}`,
                  estornado: true,
                },
              });
              return res.status(200).json({ "retorno": "PAGAMENTO ESTORNADO - MÁQUINA OFFLINE" });
            }
          } else {
            console.log("estornando... máquina offline.");

            //EVITAR ESTORNO DUPLICADO
            const registroExistente = await prisma.pix_Pagamento.findFirst({
              where: {
                mercadoPagoId: req.query.id,
                estornado: true,
              },
            });

            if (registroExistente) {
              console.log("Esse estorno ja foi feito...");
              return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
            } else {
              console.log("Seguindo...");
            }
            //FIM EVITANDO ESTORNO DUPLICADO

            estornarMP(req.query.id, tokenCliente, "máquina offline");
            //REGISTRAR O PAGAMENTO
            const novoPagamento = await prisma.pix_Pagamento.create({
              data: {
                maquinaId: maquina.id,
                valor: valor.toString(),
                mercadoPagoId: req.query.id,
                motivoEstorno: `04- máquina offline. str_id: ${str_id}`,
                estornado: true,
              },
            });
            return res.status(200).json({ "retorno": "PAGAMENTO ESTORNADO - MÁQUINA OFFLINE" });
          }
          //FIM VERIFICAÇÃO MÁQUINA OFFLINE

          //VERIFICAR SE O VALOR PAGO É MAIOR QUE O VALOR MÍNIMO

          const valorMinimo = parseFloat(maquina.valorDoPulso);
          if (valor < valorMinimo) {
            console.log("iniciando estorno...")

            //EVITAR ESTORNO DUPLICADO
            const registroExistente = await prisma.pix_Pagamento.findFirst({
              where: {
                mercadoPagoId: req.query.id,
                estornado: true,
              },
            });

            if (registroExistente) {
              console.log("Esse estorno ja foi feito...");
              return res.status(200).json({ "retorno": "error.. cliente ATRASADO - mais de 10 dias sem pagamento!" });
            } else {
              console.log("Seguindo...");
            }
            //FIM EVITANDO ESTORNO DUPLICADO


            //REGISTRAR O PAGAMENTO
            const novoPagamento = await prisma.pix_Pagamento.create({
              data: {
                maquinaId: maquina.id,
                valor: valor.toString(),
                mercadoPagoId: req.query.id,
                motivoEstorno: `05- valor inferior ao mínimo. str_id: ${str_id}`,
                estornado: true,
              },
            });
            console.log("estornando valor inferior ao mínimo...");

            estornarMP(req.query.id, tokenCliente, "valor inferior ao mínimo");
            return res.status(200).json({
              "retorno": `PAGAMENTO ESTORNADO - INFERIOR AO VALOR 
            MÍNIMO DE R$: ${valorMinimo} PARA ESSA MÁQUINA.`
            });
          } else {
            console.log("valor permitido finalizando operação...");
          }

          if (response.data.status != "approved") {
            console.log("pagamento não aprovado!");
            return;
          }

          //ATUALIZAR OS DADOS DA MÁQUIANA QUE ESTAMOS RECEBENDO O PAGAMENTO
          await prisma.pix_Maquina.update({
            where: {
              id: maquina.id,
            },
            data: {
              valorDoPix: valor.toString(),
              ultimoPagamentoRecebido: new Date(Date.now())
            }
          });

          //REGISTRAR O PAGAMENTO
          const novoPagamento = await prisma.pix_Pagamento.create({
            data: {
              maquinaId: maquina.id,
              valor: valor.toString(),
              mercadoPagoId: req.query.id,
              motivoEstorno: ``,
              tipo: tipoPagamento,
              taxas: taxaDaOperacao,
              clienteId: cliId,
              estornado: false,
            },
          });

          console.log('Pagamento inserido com sucesso:', novoPagamento);
          return res.status(200).json(novoPagamento);

        } else {

          //PROCESSANDO ASSINATURA - descomente esse bloco se voce for usar, obs crasha a app se vc receber pix de chave aleatoria
          // if (req.query.id) {
          //   console.log("recebendo de assinatura");
          //   axios.get(`https://api.mercadopago.com/v1/payments/${req.query.id}?access_token=${process.env.TOKEN_DE_SUA_CONTA_MP}`)
          //     .then(async function (response: any) {

          //       console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
          //       console.log(response.data.external_reference);

          //       //evitando crash da aplicação para máquina não cadastrada..
          //       if (response.data.external_reference === "Venda presencial") {
          //         return;
          //       }

          //       const cliente2 = await prisma.pix_Cliente.findFirst({
          //         where: {
          //           email: response.data.external_reference
          //         }
          //       });

          //       var dataVencimentoNova = new Date();

          //       if (cliente2 != null) {
          //         // Obtém a data atual
          //         if (cliente2.dataVencimento) {
          //           dataVencimentoNova = cliente2.dataVencimento;
          //           // Adiciona 30 dias à data atual
          //           dataVencimentoNova.setDate(dataVencimentoNova.getDate() + 30);
          //         }
          //       }

          //       // if aproved register
          //       if (response.data.status == "approved") {
          //         console.log("Registrando pagamento do cliente.");
          //         await prisma.pix_Cliente.update({
          //           where: {
          //             email: response.data.external_reference,
          //           },
          //           data: {
          //             dataVencimento: dataVencimentoNova
          //           }
          //         });
          //         mensagem = `pagamento do cliente ${response.data.date_of_expiration} registrado.`;
          //       }

          //     })
          //     .catch(function (error: any) {
          //       console.log(error);
          //       return res.status(500).json({ error: `${error.message}` });
          //     })
          // }
          //FIM PROCESSAMENTO DE ASSINATURA


          console.log(mensagem);
          return res.status(200).json({ "retorno": mensagem });
        }


      }).catch((error: any) => {
        console.error('Erro ao processar pagamento, verifique se o token está cadastrado:', error);
        // Aqui você pode adicionar qualquer lógica ou retorno desejado em caso de erro.
        return res.status(500).json({ error: `${error.message}` });
      });

  } catch (error) {
    console.error(error);
    return res.status(402).json({ "error": "error: " + error });
  }
});

//STORE ID MAQ ?valor=1
app.post("/rota-recebimento-especie/:id", async (req: any, res: any) => {

  try {

    //BUSCAR QUAL MÁQUINA ESTÁ SENDO UTILIZADA (id da máquina)
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      }
    });

    const value = req.query.valor;

    //PROCESSAR O PAGAMENTO (se eu tiver uma máquina com store_id pcahdastrado)
    if (maquina) {

      console.log(`recebendo pagamento na máquina: ${maquina.nome}`)
      //REGISTRAR O PAGhMENTO
      const novoPagamento = await prisma.pix_Pagamento.create({
        data: {
          maquinaId: maquina.id,
          valor: value,
          mercadoPagoId: "CASH",
          motivoEstorno: ``,
          tipo: "CASH",
          estornado: false,
        },
      });
      return res.status(200).json({ "pagamento registrado": "Pagamento registrado" });
    }
    else {
      console.log("error.. cliente nulo ou não encontrado!");
      return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
    }


  } catch (error) {
    console.error(error);
    return res.status(402).json({ "error": "error: " + error });
  }
});







//id da maquina e a quantidade ?valor=1
app.post("/incrementar-estoque/:id/", async (req: any, res: any) => {
  try {
    const value = req.query.valor;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!maquina) {
      return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
    }

    // Calculate the new stock value
    let novoEstoque: number | null = maquina.estoque !== null ? maquina.estoque + Number(value) : +1;

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: req.params.id,
      },
      data: {
        estoque: novoEstoque,
      },
    });

    console.log("Estoque atualizado");

    return res.status(200).json({ "Estoque atual": `${novoEstoque}` });
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(404).json({ "retorno": "Erro ao tentar atualizar estoque" });
  }
});


app.post("/incrementar-estoque2/:id/", async (req: any, res: any) => {

  try {

   
    const value = req.query.valor;
    

    // Find the Pix_Maquina by idh
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!maquina) {
      return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
    }

    // Calculate the new stock value
   
    let novoEstoque2: number | null = maquina.estoque2 !== null ? maquina.estoque2 + Number(value) : +1;
    

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: req.params.id,
      },
      data: {
      
        estoque2: novoEstoque2,
       
      },
    });

    console.log("Estoque atualizado");
   
    return res.status(200).json({ "Estoque atual2": `${novoEstoque2}` });
    
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(404).json({ "retorno": "Erro ao tentar atualizar estoque" });
  }


});

app.post("/incrementar-estoque3/:id/", async (req: any, res: any) => {

  try {

   
    const value = req.query.valor;
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!maquina) {
      return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
    }

    // Calculate the new stock value
   
    let novoEstoque3: number | null = maquina.estoque3 !== null ? maquina.estoque3 + Number(value) : +1;
    

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: req.params.id,
      },
      data: {
      
        estoque3: novoEstoque3,
       
      },
    });

    console.log("Estoque atualizado");
   
    return res.status(200).json({ "Estoque atual3": `${novoEstoque3}` });
    
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(404).json({ "retorno": "Erro ao tentar atualizar estoque" });
  }


});

app.post("/incrementar-estoque4/:id/", async (req: any, res: any) => {

  try {

   
    const value = req.query.valor;
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!maquina) {
      return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
    }

    // Calculate the new stock value
   
    let novoEstoque4: number | null = maquina.estoque4 !== null ? maquina.estoque4 + Number(value) : +1;
    

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: req.params.id,
      },
      data: {
      
        estoque4: novoEstoque4,
       
      },
    });

    console.log("Estoque atualizado");
   
    return res.status(200).json({ "Estoque atual4": `${novoEstoque4}` });
    
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(404).json({ "retorno": "Erro ao tentar atualizar estoque" });
  }


});


app.post("/incrementar-estoque5/:id/", async (req: any, res: any) => {

  try {

   
    const value = req.query.valor;
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!maquina) {
      return res.status(404).json({ "retorno": "error.. máquina nulo ou não encontrado!" });
    }

    // Calculate the new stock value
   
    let novoEstoque5: number | null = maquina.estoque5 !== null ? maquina.estoque5 + Number(value) : +1;
    

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: req.params.id,
      },
      data: {
      
        estoque5: novoEstoque5,
       
      },
    });

    console.log("Estoque atualizado");
   
    return res.status(200).json({ "Estoque atual5": `${novoEstoque5}` });
    
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(404).json({ "retorno": "Erro ao tentar atualizar estoque" });
  }


});

app.post('/probabilidade/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const probabilidade = req.query.valor;
   


    let val = Number(probabilidade);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        probabilidade: val,
        
      },
    });
    res.status(200).json({ message: `probabilidade configurada` });
   
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }

});


app.get('/probabilidade/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
        probabilidade: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ probabilidade: maquina.probabilidade });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});



app.post('/contador-credito/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const contadorcredito = req.query.valor;
   


    let val = Number(contadorcredito);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        contadorcredito: val,
        
      },
    });

    res.status(200).json({ message: `contador credito configuradaA` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/contador-credito/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
       contadorcredito: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ contadorcredito: maquina.contadorcredito });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});



app.post('/contador-pelucia/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const contadorpelucia = req.query.valor;
   


    let val = Number(contadorpelucia);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        contadorpelucia: val,
        
      },
    });

    res.status(200).json({ message: `contador pelucia configuradaA` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/contador-pelucia/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
       contadorpelucia: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ contadorpelucia: maquina.contadorpelucia });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});


app.post('/garra-forte/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const garraforte = req.query.valor;
   


    let val = Number(garraforte);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        garraforte: val,
        
      },
    });

    res.status(200).json({ message: `garra forte configurada` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get('/garra-forte/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
        garraforte: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ garraforte: maquina.garraforte });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});



app.get('/valor-pulso/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
        valorpulso: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ valorpulso: maquina.valorpulso });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});








app.post('/garra-media/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const garramedia = req.query.valor;
   


    let val = Number(garramedia);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        garramedia: val,
        
      },
    });

    res.status(200).json({ message: `garra media configurada` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get('/garra-media/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
        garramedia: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ garramedia: maquina.garramedia });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});




app.post('/garra-fraca/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const garrafraca = req.query.valor;
   


    let val = Number(garrafraca);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        garrafraca: val,
        
      },
    });

    res.status(200).json({ message: `garra fraca configurada` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get('/garra-fraca/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
        garrafraca: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ garrafraca: maquina.garrafraca });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});



app.post('/garra-pegada/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const garrapegada = req.query.valor;
   


    let val = Number(garrapegada);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        garrapegada: val,
        
      },
    });

    res.status(200).json({ message: `garra pegada configurada` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.get('/garra-pegada/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
      select: {
        garrapegada: true,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada!' });
    }

    res.status(200).json({ garrapegada: maquina.garrapegada });
  } catch (error) {
    console.error('Error retrieving probability:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});



//id da maquina e a quantidade ?valor=1
app.post('/setar-estoque/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const estoque = req.query.valor;
   


    let val = Number(estoque);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the update
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        estoque: val,
        
      },
    });

    return res.status(200).json({ "novo estoque:": `${val}` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post('/setar-estoque2/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const estoque2 = req.query.valor;
   


    let val2 = Number(estoque2);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the updateg
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        estoque2: val2,
        
      },
    });


    return res.status(200).json({ "novo estoque2:": `${val2}` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/setar-estoque3/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const estoque3 = req.query.valor;
   


    let val3 = Number(estoque3);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the updateg
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        estoque3: val3,
        
      },
    });


    return res.status(200).json({ "novo estoque3:": `${val3}` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post('/setar-estoque4/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const estoque4 = req.query.valor;
   


    let val4 = Number(estoque4);
    

    // Find the Pix_Maquina by id
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the updateg
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        estoque4: val4,
        
      },
    });


    return res.status(200).json({ "novo estoque4:": `${val4}` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.post('/setar-estoque5/:id', async (req, res) => {
  try {
    const maquinaId = req.params.id;
    const estoque5 = req.query.valor;
   


    let val5 = Number(estoque5);
    

    // Find the Pix_Maquina by idg
    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: maquinaId,
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Maquina não encontrada!' });
    }

    // Perform the updateg
    await prisma.pix_Maquina.update({
      where: {
        id: maquinaId,
      },
      data: {
        estoque5: val5,
        
      },
    });


    return res.status(200).json({ "novo estoque5:": `${val5}` });
    
  } catch (error) {
    console.error('Error updating stock:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get("/estoque01", async (req, res) => {
  const estoque5 = req.query.valor;
  let val5 = Number(estoque5);
  return res.status(200).json({ "valor:": `${val5}` });
});

//RELATORIO DE PAGAMENTOS POR MÁQUINA
app.get("/pagamentos/:maquinaId", verifyJWT, async (req: any, res) => {

  console.log(`${req.params.maquinaId} acessou a rota de pagamentos.`);

  try {

    var totalRecebido = 0.0;
    var totalEstornado = 0.0;
    var totalEspecie = 0.0;

    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        removido: false
      },
      orderBy: {
        data: 'desc', // 'desc' para ordem decrescente (da mais recente para a mais antiga)
      }
    });

    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.maquinaId
      }
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada' });
    }

    // Verifica se o estoque está definido e retorna seu valorgig
    const contadorcredito = maquina.contadorcredito !== null ? maquina.contadorcredito : '--';
    const contadorpelucia = maquina.contadorpelucia !== null ? maquina.contadorpelucia : '--';
    const probabilidade = maquina.probabilidade !== null ? maquina.probabilidade : '--';
    const garraforte = maquina.garraforte !== null ? maquina.garraforte : '--';
    const estoque = maquina.estoque !== null ? maquina.estoque : '--';
    const estoque2 = maquina.estoque2 !== null ? maquina.estoque2 : '--';
    const estoque3 = maquina.estoque3 !== null ? maquina.estoque3 : '--';
    const estoque4 = maquina.estoque4 !== null ? maquina.estoque4 : '--';
    const estoque5 = maquina.estoque5 !== null ? maquina.estoque5 : '--';



    let totalSemEstorno = 0;
    let totalComEstorno = 0;

    for (const pagamento of pagamentos) {
      const valor = parseFloat(pagamento.valor);

      if (pagamento.estornado === false) {
        totalSemEstorno += valor;
      } else {
        totalComEstorno += valor;
      }
    }

    const especie = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        removido: false,
        mercadoPagoId: `CASH`
      }
    });

    for (const e of especie) {
      const valor = parseFloat(e.valor);
      totalEspecie += valor;

    }

    return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "garraforte": garraforte, "contadorpelucia": contadorpelucia,"contadorcredito": contadorcredito,"probabilidade": probabilidade,"estoque": estoque, "pagamentos": pagamentos });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});

//RELATORIO DE PAGAMENTOS POR MÁQUINA
app.get("/pagamentos-adm/:maquinaId", verifyJwtPessoa, async (req: any, res) => {

  console.log(`${req.params.maquinaId} acessou a rota de pagamentos.`);

  try {

    var totalRecebido = 0.0;
    var totalEstornado = 0.0;
    var totalEspecie = 0.0;

    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        removido: false
      },
      orderBy: {
        data: 'desc', // 'desc' para ordem decrescente (da mais recente para a mais antiga)
      }
    });

    const maquina = await prisma.pix_Maquina.findUnique({
      where: {
        id: req.params.maquinaId
      }
    });

    if (!maquina) {
      return res.status(404).json({ error: 'Máquina não encontrada' });
    }

    // Verifica se o estoque está definido e retorna seu valor
    const probabilidade = maquina.probabilidade !== null ? maquina.probabilidade : '--';
    const garraforte = maquina.garraforte !== null ? maquina.garraforte : '--';
    const contadorcredito = maquina.contadorcredito !== null ? maquina.contadorcredito : '--';
    const contadorpelucia = maquina.contadorpelucia !== null ? maquina.contadorpelucia : '--';
    const estoque = maquina.estoque !== null ? maquina.estoque : '--';
    const estoque2 = maquina.estoque2 !== null ? maquina.estoque2 : '--';
    const estoque3 = maquina.estoque3 !== null ? maquina.estoque3 : '--';
    const estoque4 = maquina.estoque4 !== null ? maquina.estoque4 : '--';
    const estoque5 = maquina.estoque5 !== null ? maquina.estoque5 : '--';
  


    let totalSemEstorno = 0;
    let totalComEstorno = 0;

    for (const pagamento of pagamentos) {
      const valor = parseFloat(pagamento.valor);

      if (pagamento.estornado === false) {
        totalSemEstorno += valor;
      } else {
        totalComEstorno += valor;
      }
    }

    const especie = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        removido: false,
        mercadoPagoId: `CASH`
      }
    });

    for (const e of especie) {
      const valor = parseFloat(e.valor);
      totalEspecie += valor;

    }

    return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "garraforte": garraforte,"contadorpelucia": contadorpelucia,"contadorcredito": contadorcredito,"probabilidade": probabilidade, "estoque": estoque,"estoque2": estoque2,"estoque3": estoque3,"estoque4": estoque4,"estoque5": estoque5,"pagamentos": pagamentos });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});


//RELATORIO DE PAGAMENTOS POR MÁQUINA POR PERÍODO
app.post("/pagamentos-periodo/:maquinaId", verifyJWT, async (req: any, res) => {

  try {

    var totalRecebido = 0.0;
    var totalEstornado = 0.0;
    var totalEspecie = 0.0;

    const dataInicio = new Date(req.body.dataInicio);

    const dataFim = new Date(req.body.dataFim);

    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      orderBy: {
        data: 'desc', // 'desc' para ordem decrescente (da mais recente para a mais antiga)
      }
    });

    let totalSemEstorno = 0;
    let totalComEstorno = 0;

    for (const pagamento of pagamentos) {
      const valor = parseFloat(pagamento.valor);

      if (pagamento.estornado === false) {
        totalSemEstorno += valor;
      } else {
        totalComEstorno += valor;
      }
    }

    const especie = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        removido: false,
        mercadoPagoId: `CASH`
      }
    });

    for (const e of especie) {
      const valor = parseFloat(e.valor);
      totalEspecie += valor;

    }

    return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "pagamentos": pagamentos });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});

//RELATORIO DE PAGAMENTOS POR MÁQUINA POR PERÍODO
app.post("/pagamentos-periodo-adm/:maquinaId", verifyJwtPessoa, async (req: any, res) => {

  try {

    var totalRecebido = 0.0;
    var totalEstornado = 0.0;
    var totalEspecie = 0.0;

    const dataInicio = new Date(req.body.dataInicio);

    const dataFim = new Date(req.body.dataFim);

    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        data: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      orderBy: {
        data: 'desc', // 'desc' para ordem decrescente (da mais recente para a mais antiga)
      }
    });

    let totalSemEstorno = 0;
    let totalComEstorno = 0;

    for (const pagamento of pagamentos) {
      const valor = parseFloat(pagamento.valor);

      if (pagamento.estornado === false) {
        totalSemEstorno += valor;
      } else {
        totalComEstorno += valor;
      }
    }

    const especie = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.params.maquinaId,
        removido: false,
        mercadoPagoId: `CASH`
      }
    });

    for (const e of especie) {
      const valor = parseFloat(e.valor);
      totalEspecie += valor;

    }

    return res.status(200).json({ "total": totalSemEstorno, "estornos": totalComEstorno, "cash": totalEspecie, "pagamentos": pagamentos });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});


//ASSINATURA
app.post("/assinatura", async (req: any, res) => {
  try {
    console.log(req.body);
    return res.status(200).json({ "status": "ok" });
  } catch (err: any) {
    console.log(err);
    return res.status(500).json({ "retorno": "ERRO" });
  }
});

app.delete('/delete-pagamentos/:maquinaId', verifyJWT, async (req, res) => {
  const maquinaId = req.params.maquinaId;

  try {
    // Deletar todos os pagamentos com base no maquinaId
    const updatePagamentos = await prisma.pix_Pagamento.updateMany({
      where: {
        maquinaId: maquinaId
      },
      data: {
        removido: true
      }
    });

    res.status(200).json({ message: `Todos os pagamentos para a máquina com ID ${maquinaId} foram removidos.` });
  } catch (error) {
    console.error('Erro ao deletar os pagamentos:', error);
    res.status(500).json({ error: 'Erro ao deletar os pagamentos.' });
  }
});

app.delete('/delete-pagamentos-adm/:maquinaId', verifyJwtPessoa, async (req, res) => {
  const maquinaId = req.params.maquinaId;

  try {
    // Deletar todos os pagamentos com base no maquinaId
    const updatePagamentos = await prisma.pix_Pagamento.updateMany({
      where: {
        maquinaId: maquinaId
      },
      data: {
        removido: true
      }
    });

    res.status(200).json({ message: `Todos os pagamentos para a máquina com ID ${maquinaId} foram removidos.` });
  } catch (error) {
    console.error('Erro ao deletar os pagamentos:', error);
    res.status(500).json({ error: 'Erro ao deletar os pagamentos.' });
  }
});

//RELATÓRIOS
app.post("/relatorio-01-cash", verifyJWT, async (req, res) => {
  try {

    console.log(`************** cash`);
    console.log(req.body);

    //return res.status(200).json({valor : "2"});
    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        estornado: false,
        mercadoPagoId: "CASH",
        maquinaId: req.body.maquinaId,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });

    // Calculando o somatório dos valores dos pagamentos
    const somatorio = pagamentos.reduce((acc, pagamento) => acc + parseInt(pagamento.valor), 0);

    return res.status(200).json({ valor: somatorio });


  } catch (e) {
    res.json({ error: "error" + e });
  }
});

app.post("/relatorio-01-cash-adm", verifyJwtPessoa, async (req, res) => {
  try {

    console.log(`************** cash`);
    console.log(req.body);

    //return res.status(200).json({valor : "2"});
    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        estornado: false,
        mercadoPagoId: "CASH",
        maquinaId: req.body.maquinaId,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });

    // Calculando o somatório dos valores dos pagamentos
    const somatorio = pagamentos.reduce((acc, pagamento) => acc + parseInt(pagamento.valor), 0);

    return res.status(200).json({ valor: somatorio });


  } catch (e) {
    res.json({ error: "error" + e });
  }
});



app.post("/relatorio-02-taxas", verifyJWT, async (req, res) => {
  try {

    console.log(`************** taxas`);
    console.log(req.body);

    if (req.body.maquinaId == null) {
      return res.status(500).json({ error: `necessário informar maquinaId` });
    }

    try {

      const pagamentos_pix = await prisma.pix_Pagamento.findMany({
        where: {
          maquinaId: req.body.maquinaId,
          tipo: "bank_transfer",
          estornado: false,
          data: {
            gte: new Date(req.body.dataInicio),
            lte: new Date(req.body.dataFim),
          }
        }
      });


      let totalTaxasPix = 0;
      for (const pagamento of pagamentos_pix) {
        const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
        totalTaxasPix += parseFloat(taxa) || 0;
      }



      const pagamentos = await prisma.pix_Pagamento.findMany({
        where: {
          maquinaId: req.body.maquinaId,
          tipo: "credit_card",
          estornado: false,
          data: {
            gte: new Date(req.body.dataInicio),
            lte: new Date(req.body.dataFim),
          }
        }
      });


      let totalTaxasCredito = 0;
      for (const pagamento of pagamentos) {
        const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
        totalTaxasCredito += parseFloat(taxa) || 0;
      }

      const pagamentos_debito = await prisma.pix_Pagamento.findMany({
        where: {
          maquinaId: req.body.maquinaId,
          tipo: "debit_card",
          estornado: false,
          data: {
            gte: new Date(req.body.dataInicio),
            lte: new Date(req.body.dataFim),
          }
        }
      });


      let totalTaxasDebito = 0;
      for (const pagamento of pagamentos_debito) {
        const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
        totalTaxasDebito += parseFloat(taxa) || 0;
      }


      return res.status(200).json({ pix: totalTaxasPix, credito: totalTaxasCredito, debito: totalTaxasDebito });


    } catch (e) {
      res.json({ error: "error" + e });
    }

  } catch (e) {
    res.json({ "error": "error" + e });
  }
});



app.post("/relatorio-02-taxas-adm", verifyJwtPessoa, async (req, res) => {
  try {

    console.log(`************** taxas`);
    console.log(req.body);

    if (req.body.maquinaId == null) {
      return res.status(500).json({ error: `necessário informar maquinaId` });
    }

    try {

      const pagamentos_pix = await prisma.pix_Pagamento.findMany({
        where: {
          maquinaId: req.body.maquinaId,
          tipo: "bank_transfer",
          estornado: false
        }
      });


      let totalTaxasPix = 0;
      for (const pagamento of pagamentos_pix) {
        const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
        totalTaxasPix += parseFloat(taxa) || 0;
      }



      const pagamentos = await prisma.pix_Pagamento.findMany({
        where: {
          maquinaId: req.body.maquinaId,
          tipo: "credit_card",
          estornado: false
        }
      });


      let totalTaxasCredito = 0;
      for (const pagamento of pagamentos) {
        const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
        totalTaxasCredito += parseFloat(taxa) || 0;
      }

      const pagamentos_debito = await prisma.pix_Pagamento.findMany({
        where: {
          maquinaId: req.body.maquinaId,
          tipo: "debit_card",
          estornado: false
        }
      });


      let totalTaxasDebito = 0;
      for (const pagamento of pagamentos_debito) {
        const taxa = pagamento.taxas !== null ? pagamento.taxas : "0";
        totalTaxasDebito += parseFloat(taxa) || 0;
      }


      return res.status(200).json({ pix: totalTaxasPix, credito: totalTaxasCredito, debito: totalTaxasDebito });


    } catch (e) {
      res.json({ error: "error" + e });
    }

  } catch (e) {
    res.json({ "error": "error" + e });
  }
});


app.post("/relatorio-03-pagamentos", verifyJWT, async (req, res) => {
  try {

    console.log(`************** pagamentos`);
    console.log(req.body);

    if (req.body.maquinaId == null) {
      return res.status(500).json({ error: `necessário informar maquinaId` });
    }

    const pagamentos_pix = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        tipo: "bank_transfer",
        estornado: false,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });


    let pagamentosPix = 0;
    for (const pagamento of pagamentos_pix) {
      const valor = pagamento.valor !== null ? pagamento.valor : "0";
      pagamentosPix += parseFloat(valor) || 0;
    }

    const pagamentos_credito = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        tipo: "credit_card",
        estornado: false,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });


    let pagamentosCredito = 0;
    for (const pagamento of pagamentos_credito) {
      const valorCredito = pagamento.valor !== null ? pagamento.valor : "0";
      pagamentosCredito += parseFloat(valorCredito) || 0;
    }

    const pagamentos_debito = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        tipo: "debit_card",
        estornado: false,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });


    let pagamentosDebito = 0;
    for (const pagamento of pagamentos_debito) {
      const valorDebito = pagamento.valor !== null ? pagamento.valor : "0";
      pagamentosDebito += parseFloat(valorDebito) || 0;
    }

    return res.status(200).json({ pix: pagamentosPix, especie: -1, credito: pagamentosCredito, debito: pagamentosDebito });


  } catch (e) {
    res.json({ "error": "error" + e });
  }
});

app.post("/relatorio-03-pagamentos-adm", verifyJwtPessoa, async (req, res) => {
  try {

    console.log(`************** pagamentos`);
    console.log(req.body);

    if (req.body.maquinaId == null) {
      return res.status(500).json({ error: `necessário informar maquinaId` });
    }

    const pagamentos_pix = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        tipo: "bank_transfer",
        estornado: false,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });


    let pagamentosPix = 0;
    for (const pagamento of pagamentos_pix) {
      const valor = pagamento.valor !== null ? pagamento.valor : "0";
      pagamentosPix += parseFloat(valor) || 0;
    }

    const pagamentos_credito = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        tipo: "credit_card",
        estornado: false,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });


    let pagamentosCredito = 0;
    for (const pagamento of pagamentos_credito) {
      const valorCredito = pagamento.valor !== null ? pagamento.valor : "0";
      pagamentosCredito += parseFloat(valorCredito) || 0;
    }

    const pagamentos_debito = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        tipo: "debit_card",
        estornado: false,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        }
      }
    });


    let pagamentosDebito = 0;
    for (const pagamento of pagamentos_debito) {
      const valorDebito = pagamento.valor !== null ? pagamento.valor : "0";
      pagamentosDebito += parseFloat(valorDebito) || 0;
    }

    return res.status(200).json({ pix: pagamentosPix, especie: -1, credito: pagamentosCredito, debito: pagamentosDebito });


  } catch (e) {
    res.json({ "error": "error" + e });
  }
});

app.post("/relatorio-04-estornos", verifyJWT, async (req, res) => {
  try {

    console.log(`************** estornos`);
    console.log(req.body);

    if (req.body.maquinaId == null) {
      return res.status(500).json({ error: `necessário informar maquinaId` });
    }

    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        estornado: true,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        },
      },
      select: {
        valor: true,
      },
    });

    // Calculando o somatório dos valores dos pagamentos
    const somatorioValores = pagamentos.reduce((acc, curr) => {
      return acc + parseFloat(curr.valor);
    }, 0);

    return res.status(200).json({ valor: somatorioValores });


  } catch (e) {
    res.json({ "error": "error" + e });
  }
});

app.post("/relatorio-04-estornos-adm", verifyJwtPessoa, async (req, res) => {
  try {

    console.log(`************** estornos`);
    console.log(req.body);

    if (req.body.maquinaId == null) {
      return res.status(500).json({ error: `necessário informar maquinaId` });
    }

    const pagamentos = await prisma.pix_Pagamento.findMany({
      where: {
        maquinaId: req.body.maquinaId,
        estornado: true,
        data: {
          gte: new Date(req.body.dataInicio),
          lte: new Date(req.body.dataFim),
        },
      },
      select: {
        valor: true,
      },
    });

    // Calculando o somatório dos valores dos pagamentos
    const somatorioValores = pagamentos.reduce((acc, curr) => {
      return acc + parseFloat(curr.valor);
    }, 0);

    return res.status(200).json({ valor: somatorioValores });


  } catch (e) {
    res.json({ "error": "error" + e });
  }
});






//git add . 

//git commit -m "msg"

//git push 
app.listen(PORT, () => console.log(`localhost:${PORT}`)); 