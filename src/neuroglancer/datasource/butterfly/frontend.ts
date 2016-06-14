import {registerDataSourceFactory} from 'neuroglancer/datasource/factory';
import {getShardedVolume, tokenAndChannelCompleter} from 'neuroglancer/datasource/ndstore/frontend';

const HOSTNAMES = ['http://openconnecto.me', 'http://www.openconnecto.me'];

export function getVolume(path: string) {
  return getShardedVolume(HOSTNAMES, path);
}

export function volumeCompleter(url: string) {
  return tokenAndChannelCompleter(HOSTNAMES, url);
}

registerDataSourceFactory('butterfly', {
  description: 'Rhoana Butterfly Server',
  getVolume,
  volumeCompleter,
});
