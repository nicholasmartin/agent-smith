# Minimalist Dashboard UI Implementation

This document outlines the core structure for a minimalist Agent Smith dashboard using the TailAdmin framework. This simplified implementation focuses on the basic layout needed to test authentication, with a header, sidebar navigation, and main content area.

## 1. Setup TailAdmin

1. Download TailAdmin Free version from [https://tailadmin.com/](https://tailadmin.com/)
2. Extract the core CSS and JavaScript files to your project:

```
public/
├── css/
│   ├── tailwind.css        <- Copy from TailAdmin dist/css/
│   └── dashboard.css       <- Create for custom styles
├── js/
│   ├── main.js             <- Copy from TailAdmin dist/js/ 
│   └── auth-handler.js     <- From previous implementation
└── dashboard.html          <- New file we'll create
```

## 2. Create Dashboard HTML

Create the file `public/dashboard.html` with this basic structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent Smith Dashboard</title>
  <link rel="icon" href="images/favicon.png" type="image/png">
  
  <!-- TailAdmin CSS -->
  <link rel="stylesheet" href="css/tailwind.css" />
  <link rel="stylesheet" href="css/dashboard.css" />
  
  <!-- Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <!-- Supabase -->
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <script src="js/supabase-client.js"></script>
</head>
<body
  x-data="{ sidebarOpen: false }"
  class="font-inter bg-gray-50"
>
  <!-- ===== Page Wrapper Start ===== -->
  <div class="flex h-screen overflow-hidden">
    <!-- ===== Sidebar Start ===== -->
    <aside
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      class="absolute left-0 top-0 z-40 h-full w-72 bg-white shadow-lg transition-transform duration-300 xl:static xl:translate-x-0"
    >
      <!-- Sidebar Header -->
      <div class="flex items-center justify-between gap-2 px-6 py-5 lg:py-6">
        <a href="index.html" class="text-xl font-semibold text-black">
          Agent<span class="text-primary">Smith</span>
        </a>
        <button
          @click="sidebarOpen = false"
          class="block xl:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      
      <!-- Sidebar Menu -->
      <nav class="py-4">
        <ul class="menu">
          <!-- Dashboard -->
          <li class="menu-item">
            <a href="dashboard.html" class="active">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 15.5V8.5H1.5V15.5H8.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M18.5 15.5V1.5H11.5V15.5H18.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M8.5 18.5V15.5H5.5V18.5H8.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M14.5 18.5V15.5H11.5V18.5H14.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Dashboard
            </a>
          </li>
          <!-- Results -->
          <li class="menu-item">
            <a href="results.html">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.3333 9.16667V5.83333C18.3333 4.91286 17.5871 4.16667 16.6666 4.16667H3.33331C2.41284 4.16667 1.66665 4.91286 1.66665 5.83333V14.1667C1.66665 15.0871 2.41284 15.8333 3.33331 15.8333H16.6666C17.5871 15.8333 18.3333 15.0871 18.3333 14.1667V10.8333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M1.66669 8.33333H18.3334" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Results
            </a>
          </li>
          <!-- Profile -->
          <li class="menu-item">
            <a href="profile.html">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.99996 11.6667C12.3012 11.6667 14.1666 9.8012 14.1666 7.5C14.1666 5.1988 12.3012 3.33334 9.99996 3.33334C7.69877 3.33334 5.83331 5.1988 5.83331 7.5C5.83331 9.8012 7.69877 11.6667 9.99996 11.6667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M5 16.6667C5 15 7.5 11.6667 10 11.6667C12.5 11.6667 15 15 15 16.6667" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Profile
            </a>
          </li>
          <!-- New Request -->
          <li class="menu-item">
            <a href="new-request.html">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 4.16666V15.8333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4.16669 10H15.8334" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              New Request
            </a>
          </li>
          <!-- Logout -->
          <li class="menu-item mt-auto">
            <a href="#" id="logout-link">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M13.3333 14.1667L17.5 10L13.3333 5.83334" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M17.5 10H7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              Logout
            </a>
          </li>
        </ul>
      </nav>
    </aside>
    <!-- ===== Sidebar End ===== -->

    <!-- ===== Content Area Start ===== -->
    <div class="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <!-- ===== Header Start ===== -->
      <header class="sticky top-0 z-30 flex w-full bg-white shadow">
        <div class="flex flex-grow items-center justify-between py-4 px-4 md:px-6 2xl:px-11">
          <div class="flex items-center gap-2 sm:gap-4">
            <!-- Hamburger Toggle Button -->
            <button
              @click="sidebarOpen = !sidebarOpen"
              class="block xl:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 7.5H17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M2.5 12.5H17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <a href="dashboard.html" class="block xl:hidden">
              Agent<span class="text-primary">Smith</span>
            </a>
          </div>

          <div class="flex items-center gap-3">
            <!-- User Menu -->
            <div class="relative" x-data="{ dropdownOpen: false }">
              <button @click="dropdownOpen = !dropdownOpen" class="flex items-center gap-2">
                <span class="hidden text-right sm:block">
                  <span class="block text-sm font-medium text-black user-name">User Name</span>
                  <span class="block text-xs user-email">user@example.com</span>
                </span>
                <span class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-semibold">
                  US
                </span>
              </button>
              <!-- Dropdown -->
              <div
                x-show="dropdownOpen"
                @click.outside="dropdownOpen = false"
                class="absolute right-0 mt-2 w-48 rounded-md bg-white py-2 shadow-lg"
                x-transition:enter="transition ease-out duration-100"
                x-transition:enter-start="opacity-0 scale-95"
                x-transition:enter-end="opacity-100 scale-100"
                x-transition:leave="transition ease-in duration-75"
                x-transition:leave-start="opacity-100 scale-100"
                x-transition:leave-end="opacity-0 scale-95"
              >
                <a href="profile.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</a>
                <a href="#" id="dropdown-logout" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>
              </div>
            </div>
          </div>
        </div>
      </header>
      <!-- ===== Header End ===== -->

      <!-- ===== Main Content Start ===== -->
      <main class="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <!-- Password Setting Modal -->
        <div id="password-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" style="display: none;">
          <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 class="mb-4 text-xl font-bold">Set Your Password</h2>
            <p class="mb-6 text-gray-600">Please set a password to complete your account setup.</p>
            
            <form id="password-form" class="space-y-4">
              <div>
                <label for="new-password" class="mb-2 block text-sm font-medium">New Password</label>
                <input type="password" id="new-password" class="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" required>
              </div>
              <div>
                <label for="confirm-password" class="mb-2 block text-sm font-medium">Confirm Password</label>
                <input type="password" id="confirm-password" class="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5" required>
              </div>
              <div id="password-status" class="text-sm"></div>
              <button type="submit" class="w-full rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-medium text-white">Set Password</button>
            </form>
          </div>
        </div>
        
        <!-- Dashboard Content -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
          <!-- Stats Card -->
          <div class="rounded-md border border-gray-200 bg-white py-6 px-7.5 shadow-md">
            <div class="flex h-11.5 w-11.5 items-center justify-center rounded-md bg-primary bg-opacity-10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 10H7C9 10 10 9 10 7V5C10 3 9 2 7 2H5C3 2 2 3 2 5V7C2 9 3 10 5 10Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M17 10H19C21 10 22 9 22 7V5C22 3 21 2 19 2H17C15 2 14 3 14 5V7C14 9 15 10 17 10Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M17 22H19C21 22 22 21 22 19V17C22 15 21 14 19 14H17C15 14 14 15 14 17V19C14 21 15 22 17 22Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M5 22H7C9 22 10 21 10 19V17C10 15 9 14 7 14H5C3 14 2 15 2 17V19C2 21 3 22 5 22Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="mt-4 flex items-end justify-between">
              <div>
                <h4 class="text-2xl font-bold text-black">3</h4>
                <span class="text-sm font-medium">Total Results</span>
              </div>
            </div>
          </div>
          
          <!-- Welcome Card -->
          <div class="col-span-1 md:col-span-2 rounded-md border border-gray-200 bg-white py-6 px-7.5 shadow-md">
            <h3 class="text-xl font-semibold">Welcome back, <span class="user-name">User</span>!</h3>
            <p class="mt-2 text-gray-600">Here's a summary of your Agent Smith activity.</p>
            <a href="new-request.html" class="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-white">New Request</a>
          </div>
        </div>
        
        <!-- Recent Results Table -->
        <div class="mt-6 rounded-md border border-gray-200 bg-white px-5 pb-5 pt-6 shadow-md">
          <h4 class="mb-6 text-xl font-semibold text-black">Recent Results</h4>
          
          <div class="overflow-x-auto">
            <table class="w-full table-auto">
              <thead>
                <tr class="bg-gray-100 text-left">
                  <th class="px-4 py-4 font-medium text-black">Date</th>
                  <th class="px-4 py-4 font-medium text-black">Domain</th>
                  <th class="px-4 py-4 font-medium text-black">Status</th>
                  <th class="px-4 py-4 font-medium text-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                <!-- Sample data - will be populated by API -->
                <tr>
                  <td class="border-b border-gray-200 px-4 py-5">2025-04-10</td>
                  <td class="border-b border-gray-200 px-4 py-5">example.com</td>
                  <td class="border-b border-gray-200 px-4 py-5">
                    <span class="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">Completed</span>
                  </td>
                  <td class="border-b border-gray-200 px-4 py-5">
                    <a href="#" class="text-primary hover:underline">View</a>
                  </td>
                </tr>
                <tr>
                  <td class="border-b border-gray-200 px-4 py-5">2025-04-08</td>
                  <td class="border-b border-gray-200 px-4 py-5">another-site.com</td>
                  <td class="border-b border-gray-200 px-4 py-5">
                    <span class="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">Completed</span>
                  </td>
                  <td class="border-b border-gray-200 px-4 py-5">
                    <a href="#" class="text-primary hover:underline">View</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <!-- ===== Main Content End ===== -->
    </div>
    <!-- ===== Content Area End ===== -->
  </div>
  <!-- ===== Page Wrapper End ===== -->

  <!-- JavaScript Libraries -->
  <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script src="js/main.js"></script>
  <script src="js/auth-handler.js"></script>
  
  <script>
    // Simple logout handler
    document.addEventListener('DOMContentLoaded', () => {
      const logoutLinks = document.querySelectorAll('#logout-link, #dropdown-logout');
      
      logoutLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          
          try {
            await window.supabase.auth.signOut();
            window.location.href = '/login.html';
          } catch (error) {
            console.error('Error signing out:', error);
          }
        });
      });
    });
  </script>
</body>
</html>
```

## 3. Create Dashboard CSS

Create `public/css/dashboard.css` with some basic styling:

```css
/* Dashboard specific styling */
.menu {
  @apply space-y-2 px-4;
}

.menu-item a {
  @apply flex items-center gap-2.5 rounded-md py-2 px-4 font-medium text-gray-700 duration-300 ease-in-out hover:bg-primary hover:text-white;
}

.menu-item a.active {
  @apply bg-primary text-white;
}

.text-primary {
  @apply text-blue-600;
}

.bg-primary {
  @apply bg-blue-600;
}
```

## 4. Authentication Integration

The dashboard uses the authentication setup created in the previous document:

1. The Supabase client is loaded from `supabase-client.js`
2. `auth-handler.js` manages the password modal and user session
3. Logout functionality is built into the dashboard page

## Next Steps

After implementing this basic dashboard structure:

1. Test the authentication flow from form submission to dashboard access
2. Verify the password setting modal appears and works correctly
3. Test the logout functionality

Once the authentication flow is working correctly, you can then enhance the dashboard with actual data from the API and add additional features as needed.
