import { createApp } from './app';
import { config } from './config';

const server = createApp();

server.listen(config.port, config.host, function () {
  console.log('API disponible sur http://' + config.host + ':' + config.port);
});