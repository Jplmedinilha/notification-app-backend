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
    
  const itensSent = []; //itens que foram notificados serão inseridos aqui para evitar notificações duplicadas
  
  const connection = mysql.createConnection(dbConfig);
  
  const query = 'SELECT nome, qty FROM estoque;';

  function performCheck() {
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Erro ao executar a consulta:', err);
        return;
      }  
      const filteredResults = results.filter((row) => row.qty > 100);
  
      filteredResults.forEach((item) => {
        if (itensSent.includes(item.nome)) {
          return;
        }
  
        sendNotification(item);        
        itensSent.push(item.nome); 
      });
  
      // Verifica se algum item no array itensSent teve sua quantidade diminuída e remove
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

  function getTokens() {
    const query = 'SELECT token FROM tokens;';
    return new Promise((resolve, reject) => {
      connection.query(query, (err, results) => {
        if (err) {
          reject(err);
          return;
        }
  
        // Extrai os tokens dos resultados e cria um array com eles
        const tokens = results.map((row) => row.token);
  
        resolve(tokens);
      });
    });
  }
  
  function sendNotification(item) {
    getTokens()
    .then((tokens) => {
        const message = {
            notification: {
              title: 'Notificação',
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
    })
    .catch((error) => {
        console.error('Erro ao obter os tokens:', error);
    });
  }
  
  function startLoop() {
    performCheck();
    setTimeout(startLoop, process.env.CYCLE_TIME);
  }
  
  connection.connect((err) => {
    if (err) {
      console.error('Erro ao conectar ao banco de dados MySQL:', err);
      return;
    }
  
    console.log('Conexão estabelecida com sucesso.');
  
    startLoop();
  });