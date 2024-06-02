const OrgDTO = (org) => {
    
    if (!org) return null;
    const { _id, name, email, phone} = org;
    const id = _id;
    return {
        id,
        name,
        email,
        phone,
    };
}

module.exports = OrgDTO;