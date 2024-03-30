import * as log from "../log.mjs";

const SMEE_BASE_URL = "https://smee.io";
const createSmeeChannel = async () => {
  const response = await fetch(SMEE_BASE_URL + "/new", {
    method: "HEAD",
    redirect: "manual",
  });
  const address = response.headers.get("location");
  if (!address) {
    log.error("Failed to create a new Smee.io channel");
    process.exit(1);
  }
  return address.slice(SMEE_BASE_URL.length + 1);
};

export default createSmeeChannel;
