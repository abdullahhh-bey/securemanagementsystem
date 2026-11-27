function createAdminController(service, getActorId) {
  return {
    async listUsers(req, res) {
      res.json(await service.listUsers(req.validatedQuery));
    },

    async listExams(req, res) {
      res.json({ exams: await service.listExams() });
    },

    async listAuditLog(req, res) {
      res.json(await service.listAuditLog(req.validatedQuery ?? {}));
    },

    async getUser(req, res) {
      res.json({ data: await service.getUser(req.validatedParams.id) });
    },

    async createUser(req, res) {
      const user = await service.createUser(req.validatedBody, getActorId(req));
      res.status(201).json({ data: user });
    },

    async updateProfile(req, res) {
      const user = await service.updateProfile(
        req.validatedParams.id,
        req.validatedBody,
        getActorId(req),
      );
      res.json({ data: user });
    },

    async updateRole(req, res) {
      const user = await service.updateRole(
        req.validatedParams.id,
        req.validatedBody.role,
        getActorId(req),
      );
      res.json({ data: user });
    },

    async updateStatus(req, res) {
      const user = await service.updateStatus(
        req.validatedParams.id,
        req.validatedBody.isActive,
        getActorId(req),
      );
      res.json({ data: user });
    },
  };
}

export { createAdminController };
