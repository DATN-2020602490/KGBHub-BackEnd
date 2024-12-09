export const validateSlug = (slug: string) => {
  if (slug === "") {
    return true;
  }
  if (slug.length < 3) {
    return false;
  }

  for (const char of slug) {
    if (!/[a-z0-9-_.]/.test(char)) {
      return false;
    }
  }

  return true;
};
export const validateBio = (bio: string) => {
  return bio.length <= 500;
};
export const validateUsername = (username: string): boolean => {
  if (username.length < 6 || username.length > 20) {
    return false;
  }

  const regex = /^[a-zA-Z0-9_.-]+$/;
  if (!regex.test(username)) {
    return false;
  }

  if (username.includes(" ")) {
    return false;
  }
  return true;
};
export const normalizeEmail = (email: string): string => {
  const splitEmail = email.split("@");
  let domain = "";
  if (splitEmail.length > 1) {
    email = email.includes("@") ? email.split("@")[0] : email;
    domain = splitEmail[1];
  }
  const normalizedEmail = email.replace(/\./g, "");
  return normalizedEmail.toLowerCase().concat(domain ? `@${domain}` : "");
};
export const createSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const getUniqueSuffix = async (field: string, model: any, previous = "") => {
  let uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  while (await model.findFirst({ where: { [field]: `${previous}${uniqueSuffix}` } })) {
    uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  }
  return `${previous}${uniqueSuffix}`;
};
