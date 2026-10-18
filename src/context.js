// Which AIOStreams user the current request is for. api() and the stores read it, so it never has to be passed down.
import { AsyncLocalStorage } from 'node:async_hooks';

export const viewerContext = new AsyncLocalStorage();
export const currentViewer = () => viewerContext.getStore()?.viewer ?? '';
export const runAs = (viewer, fn) => viewerContext.run({ viewer }, fn);
