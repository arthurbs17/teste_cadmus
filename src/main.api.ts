import 'reflect-metadata';
import { bootstrap } from './bootstrap';
import { TransactionsApiModule } from './modules/transactions-api.module';

void bootstrap(TransactionsApiModule, 'API_PORT');
