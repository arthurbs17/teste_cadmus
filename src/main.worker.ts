import 'reflect-metadata';
import { bootstrap } from './bootstrap';
import { SyncWorkerModule } from './modules/sync-worker.module';

void bootstrap(SyncWorkerModule, 'WORKER_PORT');
