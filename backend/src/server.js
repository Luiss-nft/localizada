const { WebSocketServer } = require("ws");
const fs = require("fs");

// Inicializa o histórico das carretas para cada área
let carretaHistory = fs.existsSync("historico.json")
  ? JSON.parse(fs.readFileSync("historico.json"))
  : { 1401: [], 1402: [], 1418: [], 1417: [], 156009: [] };

// Inicializa o status das carretas
let carretaStatus = { 
  1401: "Sem status", 
  1402: "Sem status", 
  1418: "Sem status", 
  1417: "Sem status", 
  156009: "Sem status" 
};

// Carrega o contador de viagens do arquivo, ou inicia em 0
let contadorViagens = fs.existsSync("contador.json")
  ? JSON.parse(fs.readFileSync("contador.json")).contadorViagens
  : 0;

const statusClasses = {
  "Sem status": { class: "SemStatus", color: "#808080" },
  "Em Percurso para o Campo": { class: "EmPercursoparaocampo", color: "#00FF00" },
  "Aguardando Carregamento": { class: "AguardandoCarregamento", color: "#FFA500" },
  "Aguardando Descarregamento": { class: "AguardandoDescarregamento", color: "#0000FF" },
  "Caminho para o Poço": { class: "CaminhoparaPoco", color: "#FFFF00" },
  "Concluído": { class: "Concluido", color: "#008000" },
  "Cancelado": { class: "Cancelado", color: "#FF0000" }
};

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Novo cliente conectado.");

  // Envia o histórico inicial, o status e o contador ao cliente
  ws.send(JSON.stringify({ type: "init", history: carretaHistory, statuses: carretaStatus, contadorViagens }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "update") {
        const timestamp = new Date().toLocaleString();

        // Atualiza o histórico da carreta
        if (!carretaHistory[data.carreta]) {
          carretaHistory[data.carreta] = [];
        }

        carretaHistory[data.carreta].push({
          action: data.action,
          time: timestamp,
        });

        // Atualiza o status
        carretaStatus[data.carreta] = data.status;

        // Incrementa o contador de viagens
        contadorViagens += 1;

        // Salva o histórico e o contador no arquivo
        fs.writeFileSync("historico.json", JSON.stringify(carretaHistory, null, 2));
        fs.writeFileSync("contador.json", JSON.stringify({ contadorViagens }));

        // Envia a atualização para todos os clientes conectados
        const updateMessage = JSON.stringify({
          type: "update",
          carreta: data.carreta,
          status: data.status,
          statusClass: statusClasses[data.status]?.class || "SemStatus",
          statusColor: statusClasses[data.status]?.color || "#808080",
          history: carretaHistory[data.carreta],
          area: data.area,
          contadorViagens
        });

        console.log("Enviando mensagem de atualização para todos os clientes:", updateMessage);

        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(updateMessage);
          } else {
            console.log("Cliente não está pronto para receber mensagens.");
          }
        });

        console.log(`Carreta ${data.carreta}: ${data.action} registrada às ${timestamp}`);
      }

      if (data.type === "clearHistory") {
        for (let carreta in carretaHistory) {
          carretaHistory[carreta] = [];
          carretaStatus[carreta] = 'Sem status';
        }

        fs.writeFileSync("historico.json", JSON.stringify(carretaHistory, null, 2));

        const clearMessage = JSON.stringify({
          type: "clearHistory",
          statuses: carretaStatus,
          contadorViagens
        });

        console.log("Enviando mensagem de limpeza para todos os clientes.");

        wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(clearMessage);
          }
        });

        console.log("Histórico limpo de todas as carretas.");
      }

    } catch (err) {
      console.error("Erro ao processar mensagem:", err);
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado.");
  });
});

console.log("Servidor WebSocket rodando na porta 8080");
