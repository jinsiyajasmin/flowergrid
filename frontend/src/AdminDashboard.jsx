import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Avatar,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  useTheme,
  useMediaQuery,
  Chip,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SearchIcon from "@mui/icons-material/Search";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import flowerGridLogo from "../assets/flower.png";
import flower from "../assets/flowergrid_logo_text.png";
import PeopleIcon from "../assets/none.png";
import AnimatedDashboardIcon from "./components/AnimatedDashboardIcon";




const API_BASE = "https://flowergrid-7mw2.vercel.app";

export default function AdminDashboard() {
  const [summaries, setSummaries] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === "saminadmin" && password === "Flowergrid123") {
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Invalid credentials");
    }
  };

  const fetchSummaries = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/summaries`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Failed to fetch summaries");
        return;
      }

      const data = await res.json();
      const safeData = Array.isArray(data) ? data : [];
      setSummaries(safeData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchSummaries();
      const interval = setInterval(fetchSummaries, 15000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const handleViewSummary = (userEmail) => {
    const userSummaries = summariesByUser[userEmail] || [];
    const sorted = [...userSummaries].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setSelectedSummary(sorted);
    setDialogOpen(true);
  };


  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedSummary(null);
  };

  const summariesByUser = summaries.reduce((acc, item) => {
    if (!acc[item.email]) {
      acc[item.email] = [];
    }
    acc[item.email].push(item);
    return acc;
  }, {});

  const usersForTable = Object.values(summariesByUser)
    .map(userSummaries =>
      userSummaries.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0]
    )
    .filter(user => {
      if (!searchQuery) return true;
      const lowerQuery = searchQuery.toLowerCase();
      return (
        (user.name && user.name.toLowerCase().includes(lowerQuery)) ||
        (user.email && user.email.toLowerCase().includes(lowerQuery))
      );
    });

  const totalProspects = usersForTable.length;

  const growthPercentage = 7;

  if (!isLoggedIn) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex" }}>
        {/* Left Sidebar for Login */}
        {/* Single Column Layout */}
        <Box sx={{
          flex: 1,
          bgcolor: "#F5E4C8",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 2
        }}>
          <Box
            component="img"
            src={flowerGridLogo}
            alt="Flower Grid"
            sx={{ width: 160, mb: 2 }}
          />

          <Typography variant="h5" sx={{ color: "#6B5744", mb: 4, fontWeight: 500 }}>
            Welcome Samina
          </Typography>

          <Card sx={{
            p: 4,
            bgcolor: "#EAD1A8",
            borderRadius: 3,
            boxShadow: "none",
            width: "100%",
            maxWidth: 400,
            textAlign: "center"
          }}>
            <Typography variant="body2" sx={{ color: "#8B7355", mb: 3 }}>
              Please sign in to continue
            </Typography>

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                sx={{
                  mb: 2,
                  bgcolor: "#F5F1E8",
                  borderRadius: 2,
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { border: "none" },
                  },
                }}
              />

              <TextField
                fullWidth
                variant="outlined"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: "#8B7355" }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 2,
                  bgcolor: "#F5F1E8",
                  borderRadius: 2,
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { border: "none" },
                  },
                }}
              />
              {error && (
                <Typography color="error" variant="caption" sx={{ display: "block", mb: 2 }}>
                  {error}
                </Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                type="submit"
                sx={{
                  bgcolor: "#5b3f2a",
                  color: "white",
                  textTransform: "none",
                  borderRadius: 2,
                  py: 1.2,
                  fontSize: 16,
                  "&:hover": {
                    bgcolor: "#4a3322",
                  },
                }}
              >
                Login
              </Button>
            </form>
          </Card>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: "#F5E4C8",
      display: "flex"
    }}>
      {!isMobile && (
        <Box sx={{
          width: 200,
          bgcolor: "#6B4A2A",
          color: "white",
          py: 4,
          pl: 4,
          pr: 0, // No padding on right so the item connects
          display: "flex",
          flexDirection: "column",
        }}>

          <Box sx={{ mb: 6, textAlign: "center" }}>
            <Box
              component="img"
              src={flowerGridLogo}
              alt="Flower Grid"
              sx={{
                width: 140,
                mx: "auto",
                mb: 1,
              }}
            />
            <Box
              component="img"
              src={flower}
              alt="Flower Grid"
              sx={{
                width: 140,
                mx: "auto",
                mb: 1,
              }}
            />
          </Box>


          <Box sx={{
            bgcolor: "#F5E4C8", // This matches the main content background
            color: "#6B4A2A",
            borderTopLeftRadius: 15,
            borderBottomLeftRadius: 15,
            p: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            width: "82%", // Use full width of container
            // "Merged" look: removing right padding/margin effectively
            position: "relative",
            left: 4, // Slight offset to ensure overlap with main content area if needed, or just 0
            boxShadow: "none"
          }}>
            <AnimatedDashboardIcon size={24} color="#6B4A2A" />
            <Typography fontWeight={500}>Dashboard</Typography>
          </Box>
        </Box>
      )
      }

      <Box sx={{ flex: 1, p: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 1400, mx: "auto" }}>
          <Typography
            variant="h5"
            fontWeight={500}
            sx={{ mb: 3, color: "#6B5744" }}
          >
            Hello Samina!
          </Typography>

          <Card sx={{
            mb: 4,
            p: 3,
            bgcolor: "#EAD1A8",
            borderRadius: 3,
            boxShadow: "none",
            maxWidth: 300,
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>

              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  bgcolor: "#DFBF8E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
                  component="img"
                  src={PeopleIcon}
                  alt="People"
                  sx={{
                    width: 58,
                    height: 58,
                  }}
                />
              </Box>


              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "#6B5744", mb: 0.5 }}
                >
                  Total Prospects
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{ color: "#6B5744" }}
                >
                  {totalProspects}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TrendingUpIcon sx={{ fontSize: 16, color: "#4CAF50" }} />
                  <Typography variant="body2" sx={{ color: "#4CAF50" }}>
                    {growthPercentage}% this month
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Card>

          <Card sx={{
            borderRadius: 3,
            bgcolor: "#EAD1A8",
            boxShadow: "none",
            overflow: "hidden",
          }}>
            <Box sx={{ p: 3, pb: 2 }}>
              <Typography
                variant="h6"
                fontWeight={500}
                sx={{ color: "#6B5744" }}
              >
                All Prospects
              </Typography>

              <TextField
                placeholder="Search by name or email..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  bgcolor: "#F5F1E8",
                  borderRadius: 2,
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { border: "none" },
                  },
                  width: { xs: "100%", sm: 300 },
                  mt: 2,
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "#6B5744" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {isMobile ? (
              <Box sx={{ p: 2 }}>
                {usersForTable.map((item) => (

                  <Card
                    key={item._id}
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: "#EAD1A8",
                      boxShadow: "none",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                      <Avatar src={item.avatar}>
                        {!item.avatar && item.name?.[0]}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600} sx={{ color: "#6B5744" }}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#8B7355" }}>
                          {item.email}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleViewSummary(item.email)}

                      sx={{
                        bgcolor: "#6B5744",
                        color: "white",
                        textTransform: "none",
                        borderRadius: 2,
                        "&:hover": {
                          bgcolor: "#5A4936",
                        },
                      }}
                    >
                      View Summary
                    </Button>
                  </Card>
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{
                        color: "#6B5744",
                        fontWeight: 500,
                        bgcolor: "#EAD1A8",
                        borderBottom: "1px solid #D9CDB8",
                      }}>
                        Name
                      </TableCell>

                      <TableCell sx={{
                        color: "#6B5744",
                        fontWeight: 500,
                        bgcolor: "#EAD1A8",
                        borderBottom: "1px solid #D9CDB8",
                      }}>
                        Mail
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: "#6B5744",
                          fontWeight: 500,
                          bgcolor: "#EAD1A8",
                          borderBottom: "1px solid #D9CDB8",
                        }}
                      >
                        Summary
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersForTable.map((item, index) => (

                      <TableRow
                        key={item._id}
                        sx={{
                          bgcolor: "#EAD1A8",
                          "&:hover": {
                            bgcolor: "#DFBF8E",
                          },
                        }}
                      >
                        <TableCell sx={{
                          borderBottom: "1px solid #D9CDB8",
                          color: "#6B5744",
                        }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar
                              src={item.avatar || ""}
                              sx={{ width: 32, height: 32 }}
                            >
                              {!item.avatar && item.name?.[0]}
                            </Avatar>
                            {item.name}
                          </Box>
                        </TableCell>

                        <TableCell sx={{
                          borderBottom: "1px solid #D9CDB8",
                          color: "#6B5744",
                        }}>
                          {item.email}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ borderBottom: "1px solid #D9CDB8" }}
                        >
                          <Button
                            variant="contained"
                            onClick={() => handleViewSummary(item.email)}

                            sx={{
                              bgcolor: "#6B5744",
                              color: "white",
                              textTransform: "none",
                              borderRadius: 2,
                              px: 3,
                              "&:hover": {
                                bgcolor: "#5A4936",
                              },
                            }}
                          >
                            View Summary
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {usersForTable.length === 0 && (

              <Box sx={{ py: 8, textAlign: "center" }}>
                <PeopleOutlineIcon sx={{ fontSize: 64, color: "#D9CDB8" }} />
                <Typography sx={{ color: "#8B7355" }}>
                  No prospects found
                </Typography>
              </Box>
            )}
          </Card>
        </Box>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: "#F5F1E8",
          }
        }}
      >
        <DialogTitle sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#6B5744",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar src={selectedSummary?.avatar || ""}>
              {!selectedSummary?.avatar && selectedSummary?.name?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {selectedSummary?.[0]?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedSummary?.email}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "white" }}>
          {selectedSummary?.map((item, index) => (
            <Box key={item._id} sx={{ mb: 3 }}>
              <Typography
                variant="caption"
                sx={{ color: "#8B7355", display: "block", mb: 1 }}
              >
                {new Date(item.createdAt).toLocaleString('en-GB', { hour: 'numeric', minute: 'numeric', hour12: true, day: 'numeric', month: 'short', year: 'numeric' })}
              </Typography>

              <Typography
                variant="body1"
                lineHeight={1.8}
                sx={{ color: "#6B5744" }}
              >
                {item.summary || "No summary available."}
              </Typography>

              {index !== selectedSummary.length - 1 && (
                <Box sx={{ my: 2, borderBottom: "1px solid #EAD1A8" }} />
              )}
            </Box>
          ))}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseDialog}
            variant="contained"
            sx={{
              bgcolor: "#6B5744",
              color: "white",
              textTransform: "none",
              borderRadius: 2,
              px: 3,
              "&:hover": {
                bgcolor: "#5A4936",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
}
