const crypto = require("node:crypto");

const CV_PATH = "/Granth Jain CV.pdf";

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
        body: JSON.stringify(body),
    };
}

function getSiteId(headers) {
    const forwardedHost = headers["x-forwarded-host"] || headers["X-Forwarded-Host"];
    const host = forwardedHost || headers.host || headers.Host || process.env.URL;

    if (!host) {
        return null;
    }

    return host.includes("//") ? new URL(host).host : host.split(",")[0].trim();
}

async function readBody(response) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const body = await readBody(response);

    if (!response.ok) {
        const message = body && typeof body === "object" ? body.message || body.error : body;
        throw new Error(message || `${response.status} ${response.statusText}`);
    }

    return body;
}

function toBuffer(event) {
    if (!event.body) {
        return Buffer.alloc(0);
    }

    return Buffer.from(event.body, event.isBase64Encoded ? "base64" : "binary");
}

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return json(405, { error: "Method not allowed." });
    }

    const uploadPassword = process.env.CV_UPLOAD_PASSWORD;
    const netlifyToken = process.env.NETLIFY_API_TOKEN;

    if (!uploadPassword) {
        return json(500, { error: "CV_UPLOAD_PASSWORD is not configured." });
    }

    if (!netlifyToken) {
        return json(500, { error: "NETLIFY_API_TOKEN is not configured." });
    }

    const submittedPassword = event.headers["x-cv-upload-password"] || event.headers["X-CV-Upload-Password"] || "";

    if (submittedPassword !== uploadPassword) {
        return json(401, { error: "Unauthorized." });
    }

    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    if (!contentType.includes("pdf")) {
        return json(400, { error: "Please upload a PDF file." });
    }

    const siteId = getSiteId(event.headers);

    if (!siteId) {
        return json(500, { error: "Could not determine the site host." });
    }

    const fileBuffer = toBuffer(event);
    if (!fileBuffer.length) {
        return json(400, { error: "The uploaded file was empty." });
    }

    const apiBase = "https://api.netlify.com/api/v1";
    const authHeaders = {
        Authorization: `Bearer ${netlifyToken}`,
        "User-Agent": "cat-loaf-cv-uploader",
    };

    const currentFiles = await requestJson(`${apiBase}/sites/${encodeURIComponent(siteId)}/files`, {
        headers: authHeaders,
    });

    const files = {};
    for (const file of currentFiles) {
        files[file.path] = file.sha;
    }

    const cvSha = crypto.createHash("sha1").update(fileBuffer).digest("hex");
    files[CV_PATH] = cvSha;

    const deploy = await requestJson(`${apiBase}/sites/${encodeURIComponent(siteId)}/deploys`, {
        method: "POST",
        headers: {
            ...authHeaders,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ files, async: true }),
    });

    if (Array.isArray(deploy.required) && deploy.required.includes(cvSha)) {
        await requestJson(`${apiBase}/deploys/${deploy.id}/files/${encodeURIComponent(CV_PATH.slice(1))}`, {
            method: "PUT",
            headers: {
                ...authHeaders,
                "Content-Type": "application/octet-stream",
            },
            body: fileBuffer,
        });
    }

    let state = deploy.state || "preparing";

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const latest = await requestJson(`${apiBase}/sites/${encodeURIComponent(siteId)}/deploys/${deploy.id}`, {
            headers: authHeaders,
        });

        state = latest.state || state;

        if (state === "ready" || state === "current") {
            return json(200, {
                deployId: deploy.id,
                state,
                cvPath: CV_PATH,
            });
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return json(202, {
        deployId: deploy.id,
        state,
        cvPath: CV_PATH,
    });
};