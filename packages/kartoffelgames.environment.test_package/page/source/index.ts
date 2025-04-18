import { Console } from "@kartoffelgames/environment-core";
import WorkerCode from '../../library/Kartoffelgames.Environment.Test_Package.jsworker';

new Console().banner('Hello World!!!');

const myWorker = new Worker(WorkerCode);
