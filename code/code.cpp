// Array of number 
// [0 2 5 0 1 0 3]

// O : [2 5 1 3 0 0 0]

[0 1 1 0 1 0 1]
i            

[1 1 1 0 1 0 0]
       
[1 1 1 1 0 0 0]

[0 2 5 0 1 0 3]

t = 0;

i = 0 nothing
i = 1 [2 2 5 0 1 0 3]
i = 2 [2 5 5 0 1 0 3]
i = 3 [2 5 1 0 1 0 3]


[2 5 1 3 0 0 0]

 #include <bits/stdc++.h>
  using namespace std;

  int main() {
      int n;
      cin >> n;

      vector<int> nums(n);
      for (int i = 0; i < n; i++) {
          cin >> nums[i];
      }

      int t = 0;
      for (int i = 0; i < n; i++) {
          if (nums[i] != 0) {
              nums[t++] = nums[i];
          }
      }

      while (t < n) {
          nums[t++] = 0;
      }

      for (int i = 0; i < n; i++) {
          cout << nums[i] << " ";
      }
      cout << "\n";

      return 0;
  }


