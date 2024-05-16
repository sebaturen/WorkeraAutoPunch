import CryptoJS from 'crypto-js';
import axios from 'axios';
import tough from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import crc32 from 'crc-32';
import moment from 'moment';
// holidays from https://api.boostr.cl/feriados/en.json
import holidays from './chile_holidays_2024.json' assert { type: 'json' };
import config from './local_config.json' assert { type: 'json' };

function isHoliday(currentDate) {
    const year = currentDate.getFullYear();
    const month = `${currentDate.getMonth()+1}`.padStart(2, '0');
    const day = currentDate.getDate();

    const dateToCheck = `${year}-${month}-${day}`;
    if (holidays.data.some(holiday => holiday.date === dateToCheck))
        return true;
    return false;
}

///----------------------------------------------------------------
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true
}));
const https_options = {
    headers: {
        // default shit.... prevent if they check on a feature
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Content-Type': 'text/plain',
        'Is_employee': 'true'
    }
}

function encryptAES(text, key) {
    return CryptoJS.AES.encrypt(text, key).toString();
};

async function getEncryptKey() {
    const keyinfo = await client.get('https://workera.com/auth/key', https_options);
    return keyinfo.data;
}

async function loginUser(authMessage) {
    const loginPost = await client.post('https://workera.com/auth/login', authMessage, https_options);
    return loginPost;
}

async function getEmployerInfo() {
    const employerData = await client.get('https://workera.com/api-employee/employee-companias', https_options);
    return employerData.data;
}

async function getEmployeeInfo(employerNickname) {
    const employeeData = await client.get(`https://workera.com/api-employee/logged-employee-parameters/${employerNickname}`, https_options);
    return employeeData.data;
}

async function getEmployeeUserCanSigner() {
    const employeeUserCanSigner = await client.get('https://workera.com/api-employee/gd/employee-user-can-signer', https_options);
    return employeeUserCanSigner;
}

async function getDataPortal(employeeUserId) {
    https_options.headers['userEmployee'] = employeeUserId;
    const dataPortal = await client.get('https://workera.com/api-employee/cdata-portal', https_options);
    return dataPortal.data;
}

function calcCheksum(employeeId, dateStr) {
    const strCrc = `${employeeId}${dateStr}`;
    return crc32.str(strCrc) >>> 0;
}

async function sendPunch(employeeId, dataPortal, type) {
    // type can in/out~
    https_options.headers['Content-Type'] = 'application/json';
    const punchDate = moment(dataPortal['localTime'], 'YYYY/MM/DD HH:mm:ss');
    const checksum = calcCheksum('undefined', punchDate.format('YYYYMMDDHHmmss')); // yes, empoyeeID is undefined... workera bugs!~
    const punchData = {
        "dateTime": `${dataPortal['localTime']}`,
        "type": type,
        "checksum": checksum
    }
    const punchGenerateRequest = await client.post('https://workera.com/api-employee/cdata-portal', punchData, https_options);
    return punchGenerateRequest
}

async function notifyDiscord(msg) {
    if (config['discord_webhook'].length > 0) {
        const message = {
            content: `[AutoPunch] ${msg}`
        };
        await axios.post(config['discord_webhook'], message);
    }
}

// -----------
// Type: 0: in
//       1: out
async function generatePunch(type) {
    const encryptKey = await getEncryptKey();
    let encryptLoginMessage = encryptAES(
        `{"username":"${config['workera']['user']}","password":"${config['workera']['pass']}"}`, 
        encryptKey
    );
    encryptLoginMessage = `${encryptKey}${encryptLoginMessage}`;
    const loginPost = await loginUser(encryptLoginMessage);
    if (loginPost.status != 200) {
        await notifyDiscord("Can't login! check the details...?");
        return;
    }
    console.log("Login success");
    // Valid login success and cookie is saved....
    const employerData = await getEmployerInfo();
    if (!Array.isArray(employerData)) {
        await notifyDiscord("Can't get the employer information... some error ocurre... cookies?");
        return;
    }
    console.log("Employer data success", employerData[0]['nickname']);
    const employeeData = await getEmployeeInfo(employerData[0]["nickname"]);
    if (!("company" in employeeData) || !("employeeId" in employeeData['company'])) {
        await notifyDiscord("The employee information not found...");
        return;
    }
    const employeeUserId = employeeData['userEmployeeId'];
    const employeeId = employeeData['company']['employeeId'];
    console.log("Employee data info success", employeeId);
    const employeeCanSignerValidate = await getEmployeeUserCanSigner();
    if (employeeCanSignerValidate.status != 200) {
        await notifyDiscord("User can't signer... ???");
        return;
    }
    console.log("Employee can signer DONE");
    // Punch...
    const dataPortal = await getDataPortal(employeeUserId);
    const punch = await sendPunch(employeeId, dataPortal, type);
    if (punch.status != 200) {
        await notifyDiscord("Punch can't completed...");
        return;
    }
    await notifyDiscord("Punch completed successfull");
}

// crontab: 0 9,18 * * 1-5; sleep random? node .\autopunch.js
const currentDate = new Date();
if (!isHoliday(currentDate)) {
    if (currentDate.getHours() < 12) {
        await notifyDiscord("Creating in punch");
        generatePunch(0);
    } else {
        await notifyDiscord("Creating out punch");
        generatePunch(1);
    }
}