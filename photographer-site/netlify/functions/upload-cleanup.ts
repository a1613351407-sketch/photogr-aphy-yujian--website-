import {cleanup} from '../uploads';
export default async()=>{await cleanup()};
export const config={schedule:'@hourly'};
