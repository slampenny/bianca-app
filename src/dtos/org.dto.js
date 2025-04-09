const OrgDTO = (org) => {
    
    if (!org) return null;
    const { _id, stripeCustomerId, name, avatar, email, phone} = org;
    const id = _id;
    return {
        id,
        stripeCustomerId,
        name,
        avatar,
        email,
        phone,
    };
}

module.exports = OrgDTO;