const mysql = require('mysql');
const admin = require('firebase-admin');
require('dotenv').config()

const dbConfig = {
  host: process.env.DB_IP,
  user: process.env.DB_USR,
  password: process.env.DB_PW,
  database: process.env.DB_DB,
};

const serviceAccount = require(process.env.FB_SETTINGS);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  const tokens = process.env.FB_TOKENS.split(';');
  
  const itensSent = []; //itens que foram notificados serão inseridos aqui para evitar notificações duplicadas
  
  const connection = mysql.createConnection(dbConfig);
  
  const query = 'SELECT nome, qty FROM estoque;';

  function performCheck() {
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Erro ao executar a consulta:', err);
        return;
      }
        //console.log(results);
  
      const filteredResults = results.filter((row) => row.qty > 100);
  
      filteredResults.forEach((item) => {
        if (itensSent.includes(item.nome)) { //verifica o array de itens enviados
          return;
        }
  
        // if (item.qty < 100) {
        //   // Verifica se o item está presente no array itensSent e remove-o
        //   const index = itensSent.indexOf(item.nome);
        //   if (index !== -1) {
        //     itensSent.splice(index, 1);
        //   }
        //   return;
        // }
  
        // Envia a notificação para o item
        sendNotification(item);
        // Adiciona o item ao array itensSent para evitar envios repetidos
        itensSent.push(item.nome);
      });
  
      // Verifica se algum item no array itensSent teve sua quantidade diminuída e remove-o
      itensSent.forEach((itemName) => {
        const item = results.find((row) => row.nome === itemName);
        if (item && item.qty < 100) {
          const index = itensSent.indexOf(itemName);
          if (index !== -1) {
            itensSent.splice(index, 1);
          }
        }
      });
    });
  }
  
  // Função para enviar uma notificação para um item
  function sendNotification(item) {
    const message = {
      notification: {
        title: 'Título da Notificação',
        body: `O item ${item.nome} está disponível novamente.`,
      },
    };
  
    admin.messaging().sendMulticast({ tokens: tokens, notification: message.notification })
      .then((response) => {
        console.log('Notificações enviadas com sucesso:', response);
      })
      .catch((error) => {
        console.error('Erro ao enviar as notificações:', error);
      });
  }
  
  // Loop de verificação a cada 3 segundos
  function startLoop() {
    performCheck();
    setTimeout(startLoop, process.env.CYCLE_TIME); // Executa a função novamente após 3 segundos
  }
  
  // Conexão com o banco de dados MySQL
  connection.connect((err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados MySQL:', err);
      return;
    }
  
    console.log('Conexão estabelecida com sucesso.');
  
    // Inicia o loop de verificação
    startLoop();
  });