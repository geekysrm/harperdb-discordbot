const SAY_JOKE = {
  name: "sayjoke",
  description: "Say a programming joke and make everyone go ROFL!",
  options: [
    {
      type: 3,
      name: "joke",
      description: "The programming joke.",
      required: true,
    },
  ],
};

const TOP = {
  name: "top",
  description: "Find out who is the top scorer with his score.",
};

const LIST_JOKES = {
  name: "listjokes",
  description: "Display programming jokes said by a user.",
  options: [
    {
      name: "user",
      description: "The user whose jokes you want to hear.",
      type: 6,
      required: true,
    },
  ],
};

module.exports = {
  SAY_JOKE,
  TOP,
  LIST_JOKES,
};
