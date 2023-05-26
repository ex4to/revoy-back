import * as bcrypt from "bcrypt";

export const createUser = async (nickname: string, pass: string) => {
  return {
    nickname,
    pass: await bcrypt.hash(pass, 10),
    talks: []
  };
};

export const passCheck = async (raw: string, encrypted: string) => {
  return await bcrypt.compare(raw, encrypted);
};
