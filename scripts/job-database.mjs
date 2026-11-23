import {defaultJobPath} from '../lib/job-store.mjs';
import {backupJobDatabase,backupEncryptedJobDatabase,generateJobBackupKey,restoreJobDatabase,restoreEncryptedJobDatabase,verifyJobDatabase,verifyEncryptedJobDatabase} from '../lib/job-database-backup.mjs';

function usage(){
 return 'Usage:\n  node scripts/job-database.mjs backup <new-backup-file>\n  node scripts/job-database.mjs verify <database-file>\n  node scripts/job-database.mjs restore <verified-backup-file> <new-database-file>\n  node scripts/job-database.mjs keygen <new-owner-only-key-file>\n  TRAVEL_JOB_BACKUP_KEY_FILE=<key-file> node scripts/job-database.mjs backup-encrypted <new-backup-file>\n  TRAVEL_JOB_BACKUP_KEY_FILE=<key-file> node scripts/job-database.mjs verify-encrypted <backup-file>\n  TRAVEL_JOB_BACKUP_KEY_FILE=<key-file> node scripts/job-database.mjs restore-encrypted <backup-file> <new-database-file>\n\nBackup reads TRAVEL_JOB_DB or the default local job database. Restore always writes to a new file; stop the app and worker before switching TRAVEL_JOB_DB to a restored file. Encrypted commands require a separate owner-only key file; store that key separately from backups.';
}

async function main(args){
 const [operation,...paths]=args;
 const keyPath=process.env.TRAVEL_JOB_BACKUP_KEY_FILE;
 if(operation==='keygen'&&paths.length===1)return generateJobBackupKey({targetPath:paths[0]});
 if(operation==='backup-encrypted'&&paths.length===1)return backupEncryptedJobDatabase({sourcePath:defaultJobPath(),targetPath:paths[0],keyPath});
 if(operation==='verify-encrypted'&&paths.length===1)return verifyEncryptedJobDatabase({backupPath:paths[0],keyPath});
 if(operation==='restore-encrypted'&&paths.length===2)return restoreEncryptedJobDatabase({backupPath:paths[0],targetPath:paths[1],keyPath});
 if(operation==='backup'&&paths.length===1)return backupJobDatabase({sourcePath:defaultJobPath(),targetPath:paths[0]});
 if(operation==='verify'&&paths.length===1)return {status:'ok',operation:'verify',...verifyJobDatabase(paths[0])};
 if(operation==='restore'&&paths.length===2)return restoreJobDatabase({backupPath:paths[0],targetPath:paths[1]});
 throw Error(usage());
}

try{const result=await main(process.argv.slice(2));process.stdout.write(`${JSON.stringify(result)}\n`);}catch(error){process.stderr.write(`job-database: ${error.message}\n`);process.exitCode=1;}
