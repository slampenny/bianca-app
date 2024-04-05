const { default: SchemaBuilder } = require('@pothos/core');
const { default: ScopeAuthPlugin } = require('@pothos/plugin-scope-auth');
const { DateResolver } = require('graphql-scalars');
const { userService, scheduleService, authService, tokenService } = require('../../services');
const { getRoleById } = require('../../services/role.service');

const builder = new SchemaBuilder({
  plugins: [ScopeAuthPlugin],
  authScopes: async (ctx) => ({
    public: !ctx.currentUser,
    user: ctx.currentUser != null,
    caregiver: ctx.currentUser && ctx.currentUser.role === 'caregiver',
    admin: ctx.currentUser && ctx.currentUser.role === 'admin',
  }),
});

builder.addScalarType('Date', DateResolver);

builder.objectType('Role', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    permissions: t.field({
      type: ['String'],
      resolve: (role) => role.permissions,
    }),
  }),
});

const ScheduleFrequency = builder.enumType('ScheduleFrequency', {
  values: ['daily', 'weekly', 'monthly'],
});

builder.objectType('Schedule', {
  fields: (t) => ({
    frequency: t.field({ type: ScheduleFrequency, resolve: (schedule) => schedule.frequency }),
  }),
});

builder.objectType('User', {
  fields: (t) => ({
    id: t.exposeID('_id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
    phone: t.exposeString('phone'),
    role: t.field({
      type: 'Role',
      resolve: (user) => {
        return getRoleById(user.role);
      },
    }),
    caregiver: t.field({
      type: 'User',
      resolve: (user) => userService.getCaregiverById(user.caregiver),
    }),
    schedules: t.field({
      type: ['Schedule'],
      resolve: async (user) => {
        if (user.role === 'caregiver') {
          return Promise.all(user.schedules.map((scheduleId) => scheduleService.getScheduleById(scheduleId)));
        }
        return [];
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    viewer: t.field({
      type: 'User',
      authScopes: {
        user: true,
        caregiver: true,
        admin: true,
      },
      resolve: async (_query, _args, ctx) => ctx.currentUser,
    }),
  }),
});

builder.enumType('AuthTokenType', {
  values: ['REFRESH', 'ACCESS'],
});

builder.objectRef('AuthToken').implement({
  fields: (t) => ({
    value: t.exposeString('value', { nullable: false }),
    expires: t.exposeInt('expires', { nullable: false }),
  }),
});

builder.objectRef('SignInResponse').implement({
  authScopes: {
    public: true,
  },
  fields: (t) => ({
    accessToken: t.field({ type: 'AuthToken', nullable: false, resolve: (parent) => parent.accessToken }),
    refreshToken: t.field({ type: 'AuthToken', nullable: false, resolve: (parent) => parent.refreshToken }),
    user: t.field({ type: 'User', nullable: false, resolve: (parent) => parent.user }),
  }),
});

builder.inputType('SignInInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    signIn: t.field({
      authScopes: {
        public: true,
      },
      type: 'SignInResponse',
      args: {
        input: t.arg({ type: 'SignInInput', required: true }),
      },
      resolve: async (_root, args) => {
        const user = await authService.loginUserWithEmailAndPassword(args.input.email, args.input.password);
        const authTokens = await tokenService.generateAuthTokens(user);

        return {
          user,
          accessToken: authTokens.access,
          refreshToken: authTokens.refresh,
        };
      },
    }),
  }),
});

module.exports = builder;
