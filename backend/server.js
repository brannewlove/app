const app = require("./app");
const http = require("http");

// 포트 설정
const port = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server is running on port ${port}.`);
});