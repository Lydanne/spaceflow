module.exports = {
  createOpencodeClient: jest.fn().mockReturnValue({
    session: {
      create: jest.fn(),
      prompt: jest.fn(),
      delete: jest.fn(),
    },
  }),
};
