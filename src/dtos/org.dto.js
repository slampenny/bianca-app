const OrgDTO = (org) => {
  if (!org) return null;
  const { _id, stripeCustomerId, name, avatar, logo, email, phone } = org;
  const id = _id;
  return {
    id,
    stripeCustomerId,
    name,
    avatar,
    logo,
    email,
    phone,
  };
};

module.exports = OrgDTO;
