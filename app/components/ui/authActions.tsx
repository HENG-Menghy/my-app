// @/components/ui/authActions.tsx

import Login from "../buttons/login";
import Signup from "../buttons/signup";

const AuthActions = () => {
  return (
    <div className="flex items-center gap-2">
      <Login />
      <Signup />
    </div>
  );
};

export default AuthActions;
