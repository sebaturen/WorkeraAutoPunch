import CryptoJS from 'crypto-js';
import axios from 'axios';
import tough from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const WORKERA_USER = ""
const WORKERA_PASS = ""

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
        'Content-Type': 'text/plain'
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

async function getEmployeeInfo() {
    const employeeData = await client.get('https://workera.com/api-employee/employee-companias', https_options);
    return employeeData.data;
}

async function generatePunch(type) {
    // type can in/out~
}

async function generatePunch() {
    const encryptKey = await getEncryptKey();
    let encryptLoginMessage = encryptAES(
        `{"username":"${WORKERA_USER}","password":"${WORKERA_PASS}"}`, 
        encryptKey
    );
    encryptLoginMessage = `${encryptKey}${encryptLoginMessage}`;
    const loginPost = await loginUser(encryptLoginMessage);
    if (loginPost.status != 200) {
        console.error("Can't login! check the details...?");
        exit;
    }
    console.log("Login success");
    // Valid login success and cookie is saved....
    const employeeData = await getEmployeeInfo();
    if (!Array.isArray(employeeData)) {
        console.error("Can't get the employee information... some error ocurre... cookies?");
        exit;
    }
    console.log("Employee data info success", employeeData);
    /// ----------> generate punch
}

generatePunch();